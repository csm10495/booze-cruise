// Voice transcript parser. Pure function — no DOM, no storage. Tests can call
// parseVoiceCommand(transcript, { people, drinks }) directly.
//
// Goal: take a phrase like "Add a Coke for Matt and Gina" and figure out which
// drink and which people from the current cruise to select. Single drink,
// one-or-more people. Match against existing entities only — never auto-create.

(function (global) {
    'use strict';

    // --- Normalization ---------------------------------------------------

    function normalize(s) {
        if (!s) return '';
        return s
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            // Preserve commas — they're meaningful as people-list separators
            // ("Coke for Matt, Gina, and Jose"). Everything else non-alphanumeric
            // collapses to whitespace.
            .replace(/[^\p{L}\p{N}\s&,]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Strip any leading/trailing commas off a phrase for matching purposes.
    function stripCommas(s) {
        return s.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Leading-only filler stripping. Removes common command/greeting words at
    // the START of the transcript so the drink phrase isn't polluted by them.
    // We intentionally do NOT strip these elsewhere because drink/person names
    // may legitimately contain words like "the" or "a".
    const LEADING_FILLERS = [
        'please', 'okay', 'ok', 'hey',
        'add', 'order', 'log', 'record', 'put',
        'lets add', 'let us add',
        'i want', 'i would like', 'id like', 'i want to add', 'i d like'
    ];

    function stripLeadingFillers(s) {
        let out = s;
        let changed = true;
        while (changed) {
            changed = false;
            for (const filler of LEADING_FILLERS) {
                if (out === filler) { out = ''; changed = true; break; }
                if (out.startsWith(filler + ' ')) {
                    out = out.slice(filler.length + 1);
                    changed = true;
                    break;
                }
            }
        }
        return out;
    }

    // Strip leading quantity tokens ("two ", "2 ", "a ", "an ") from the drink
    // phrase only. Quantities inside drink names (e.g. "7 and 7", "Modelo 12oz")
    // are preserved because we only strip from the very start.
    const LEADING_QUANTITIES = new Set([
        'a', 'an', 'one', 'two', 'three', 'four', 'five', 'six',
        'seven', 'eight', 'nine', 'ten',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
    ]);

    function stripLeadingQuantity(phrase) {
        const tokens = phrase.split(' ');
        while (tokens.length > 1 && LEADING_QUANTITIES.has(tokens[0])) {
            tokens.shift();
        }
        return tokens.join(' ');
    }

    // --- Connector detection ---------------------------------------------

    // Connectors that separate drink-phrase from people-phrase. Speech engines
    // mishear "for" as "four" and "to" as "two", so we accept those too — but
    // only when used as a standalone connector token, never inside names.
    const CONNECTOR_TOKENS = new Set(['for', 'to', 'four', 'too', 'two']);

    function findConnectorSplits(normalizedTranscript) {
        // Connector matching is done on a comma-free version since commas
        // never act as connectors. People-phrase splitting (downstream)
        // still needs the commas, so we work them back in by tracking
        // character offsets.
        const stripped = stripCommas(normalizedTranscript);
        const tokens = stripped.split(' ');
        const splits = [];
        for (let i = 1; i < tokens.length - 1; i++) {
            if (CONNECTOR_TOKENS.has(tokens[i])) {
                splits.push({
                    left: tokens.slice(0, i).join(' '),
                    right: tokens.slice(i + 1).join(' '),
                    // Locate the connector in the ORIGINAL normalized
                    // transcript so the right side can keep its commas
                    // intact for splitPeoplePhrase().
                    rightWithCommas: extractRightWithCommas(normalizedTranscript, tokens[i], i)
                });
            }
        }
        return splits;
    }

    // Find the i-th occurrence of `connector` (as a standalone token) in the
    // original (still-comma-bearing) normalized transcript and return
    // everything after it. Tokens here are whitespace-only separated, since
    // commas are part of tokens.
    function extractRightWithCommas(normalizedWithCommas, connector, targetIndexInStripped) {
        // Rebuild a stripped tokenization but track where each token came from.
        const rawTokens = normalizedWithCommas.split(' ');
        let strippedIndex = 0;
        for (let i = 0; i < rawTokens.length; i++) {
            const cleaned = rawTokens[i].replace(/,/g, '');
            if (!cleaned) continue;
            if (cleaned === connector && strippedIndex === targetIndexInStripped) {
                return rawTokens.slice(i + 1).join(' ');
            }
            strippedIndex++;
        }
        // Fallback: no commas anywhere; just return everything after a naive split.
        return '';
    }

    // --- Matching helpers ------------------------------------------------

    function tokens(s) {
        return s.split(' ').filter(Boolean);
    }

    function tokenSet(s) {
        return new Set(tokens(s));
    }

    function jaccard(aSet, bSet) {
        if (aSet.size === 0 || bSet.size === 0) return 0;
        let intersect = 0;
        for (const t of aSet) if (bSet.has(t)) intersect++;
        const union = aSet.size + bSet.size - intersect;
        return union === 0 ? 0 : intersect / union;
    }

    // --- Drink matching --------------------------------------------------

    // Returns array of {drink, score} sorted high → low. Score conventions:
    //   100  exact normalized match
    //    80  transcript phrase ⊂ drink name (safe direction)
    //    60  drink name ⊂ transcript phrase (only if no extra drink-like noise)
    //    40  high jaccard overlap (>= 0.5)
    //    20  any jaccard overlap > 0
    function scoreDrinks(phrase, drinks) {
        const normPhrase = stripLeadingQuantity(phrase);
        if (!normPhrase) return [];

        const phraseTokens = tokenSet(normPhrase);
        const results = [];

        for (const drink of drinks) {
            const nName = normalize(drink.name);
            if (!nName) continue;

            let score = 0;

            if (nName === normPhrase) {
                score = 100;
            } else if (nName.includes(normPhrase)) {
                // transcript ⊂ name (e.g. "coke" inside "diet coke") — safe.
                // Bonus for tighter fits (smaller name = better match).
                score = 80 - Math.min(20, nName.length - normPhrase.length);
            } else if (normPhrase.includes(nName)) {
                // name ⊂ transcript (e.g. "diet coke" inside "i'd like a diet coke").
                // Risky: could match the wrong drink in a multi-drink phrase.
                // The multi-drink detector below catches the worst case.
                score = 60 - Math.min(20, normPhrase.length - nName.length);
            } else {
                const overlap = jaccard(phraseTokens, tokenSet(nName));
                if (overlap >= 0.5) score = 40;
                else if (overlap > 0) score = 20;
            }

            if (score > 0) results.push({ drink, score });
        }

        results.sort((a, b) => b.score - a.score);
        return results;
    }

    // Does the drink phrase look like it names more than one drink?
    // We say yes if two or more *different* drinks each match the phrase as
    // a name-substring (the strict "name ⊂ phrase" direction). This catches
    // "add a coke and a beer for matt" without false-positiving on "coke"
    // vs "diet coke".
    function detectMultiDrink(phrase, drinks) {
        const normPhrase = stripLeadingQuantity(phrase);
        const hits = [];
        for (const drink of drinks) {
            const nName = normalize(drink.name);
            if (!nName) continue;
            if (normPhrase === nName) continue; // exact match → single drink
            if (normPhrase.includes(' ' + nName + ' ') ||
                normPhrase.startsWith(nName + ' ') ||
                normPhrase.endsWith(' ' + nName)) {
                hits.push(drink);
            }
        }
        // Two distinct drinks both appear as full-name substrings → multi-drink.
        if (hits.length < 2) return null;
        // Reject only if the hits are not "nested" (e.g. "coke" inside "diet coke"
        // shouldn't count as two distinct drinks).
        const distinct = hits.filter((d, i) =>
            !hits.some((other, j) =>
                i !== j &&
                normalize(other.name).includes(normalize(d.name)) &&
                normalize(other.name) !== normalize(d.name))
        );
        return distinct.length >= 2 ? distinct : null;
    }

    // --- People matching -------------------------------------------------

    function splitPeoplePhrase(phrase) {
        // Split on commas, " and ", " & ". After splitting we re-trim each.
        return phrase
            .split(/\s*,\s*|\s+and\s+|\s+&\s+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    // For a single people-token, return ranked candidates against the people
    // list. Score conventions:
    //   100  exact normalized full-name match
    //    80  unique first-name match (e.g. token "matt" → "Matt Smith" when no
    //         other person has "matt" as first token)
    //    60  unique substring match (token ⊂ name) where name has only one
    //         such hit across the people list
    //    40  per-token substring match (e.g. token "matt" ⊂ "Matt-Hewson" name token)
    //    20  any substring match
    function scorePersonToken(token, people) {
        const nToken = normalize(token);
        if (!nToken) return [];

        const exact = [];
        const firstName = [];
        const tokenLevel = [];
        const substring = [];

        for (const person of people) {
            const nName = normalize(person.name);
            if (!nName) continue;
            if (nName === nToken) {
                exact.push(person);
                continue;
            }
            const nameTokens = tokens(nName);
            if (nameTokens[0] === nToken) {
                firstName.push(person);
                continue;
            }
            // Check if any single name token matches the spoken token in
            // either direction. Handles speech engines that smush parts of
            // a name together or split them oddly (e.g. "matt" → "matt smith"
            // by exact-first-token, but also "matter" recognized for "matt"
            // → "matter".includes("matt")).
            let tokenLevelHit = false;
            for (const nt of nameTokens) {
                if (nt === nToken || nt.includes(nToken) || nToken.includes(nt)) {
                    tokenLevelHit = true;
                    break;
                }
            }
            if (tokenLevelHit) {
                tokenLevel.push(person);
                continue;
            }
            if (nName.includes(nToken) || nToken.includes(nName)) {
                substring.push(person);
            }
        }

        const results = [];
        for (const p of exact) results.push({ person: p, score: 100 });
        if (results.length === 0) {
            if (firstName.length === 1) {
                results.push({ person: firstName[0], score: 80 });
            } else if (firstName.length > 1) {
                // Ambiguous first-name match — surface all of them so the caller
                // can report which ones.
                for (const p of firstName) results.push({ person: p, score: 80 });
            } else if (tokenLevel.length === 1) {
                results.push({ person: tokenLevel[0], score: 40 });
            } else if (tokenLevel.length > 1) {
                for (const p of tokenLevel) results.push({ person: p, score: 40 });
            } else if (substring.length === 1) {
                results.push({ person: substring[0], score: 60 });
            } else if (substring.length > 1) {
                for (const p of substring) results.push({ person: p, score: 20 });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    function matchPeople(phrase, people) {
        const tokensList = splitPeoplePhrase(phrase);
        if (tokensList.length === 0) {
            return { ok: false, kind: 'no-people', error: 'No people heard in the phrase' };
        }

        const matched = [];
        const seenIds = new Set();
        const unmatched = [];
        const ambiguous = [];

        for (const tok of tokensList) {
            const candidates = scorePersonToken(tok, people);
            if (candidates.length === 0) {
                unmatched.push(tok);
                continue;
            }
            const top = candidates[0].score;
            const topCandidates = candidates.filter(c => c.score === top);
            if (topCandidates.length > 1) {
                ambiguous.push({ token: tok, candidates: topCandidates.map(c => c.person) });
                continue;
            }
            const person = topCandidates[0].person;
            if (!seenIds.has(person.id)) {
                seenIds.add(person.id);
                matched.push(person);
            }
        }

        if (unmatched.length > 0) {
            return {
                ok: false,
                kind: 'no-people',
                error: `Couldn't find ${unmatched.length === 1 ? 'a person' : 'people'} matching "${unmatched.join('", "')}"`
            };
        }
        if (ambiguous.length > 0) {
            const a = ambiguous[0];
            const names = a.candidates.map(p => p.name).join(', ');
            return {
                ok: false,
                kind: 'ambiguous',
                error: `"${a.token}" matched multiple people: ${names}`
            };
        }
        if (matched.length === 0) {
            return { ok: false, kind: 'no-people', error: 'No matching people in this cruise' };
        }
        return { ok: true, people: matched };
    }

    // --- Top-level entry -------------------------------------------------

    function parseVoiceCommand(rawTranscript, ctx) {
        const people = (ctx && ctx.people) || [];
        const drinks = (ctx && ctx.drinks) || [];

        if (!rawTranscript || !rawTranscript.trim()) {
            return { ok: false, kind: 'no-match', error: "Didn't catch that — try again" };
        }

        const normalized = stripLeadingFillers(normalize(rawTranscript));
        if (!normalized) {
            return { ok: false, kind: 'no-match', error: 'Phrase was empty after cleanup' };
        }

        const splits = findConnectorSplits(normalized);
        if (splits.length === 0) {
            return {
                ok: false,
                kind: 'no-match',
                error: 'Say something like "Coke for Matt and Gina"'
            };
        }

        // Score every candidate split. We need:
        //   - the drink phrase to produce at least one drink candidate
        //   - the people phrase to fully match (all tokens resolved)
        //   - no multi-drink in the drink phrase
        // Pick the split with the highest combined score (drink + people).
        let best = null;
        const splitResults = [];
        for (const sp of splits) {
            const drinkPhrase = sp.left;
            // Use the comma-preserving right side for people splitting so
            // "matt, gina, and jose" splits into 3 tokens, not 2.
            const peoplePhrase = sp.rightWithCommas || sp.right;

            const multi = detectMultiDrink(drinkPhrase, drinks);
            const drinkCandidates = scoreDrinks(drinkPhrase, drinks);
            const peopleResult = matchPeople(peoplePhrase, people);

            const drinkScore = drinkCandidates.length ? drinkCandidates[0].score : 0;
            const peopleScore = peopleResult.ok
                ? peopleResult.people.length * 100
                : 0;

            const result = {
                split: sp,
                multi,
                drinkCandidates,
                peopleResult,
                combinedScore: peopleResult.ok && !multi && drinkScore > 0
                    ? drinkScore + peopleScore
                    : -1
            };
            splitResults.push(result);
            if (!best || result.combinedScore > best.combinedScore) best = result;
        }

        if (!best || best.combinedScore < 0) {
            // None of the splits parsed cleanly. Report the most informative failure
            // — prefer multi-drink, then people failures, then drink failures.
            const multiHit = splitResults.find(r => r.multi);
            if (multiHit) {
                const names = multiHit.multi.map(d => d.name).join(' and ');
                return {
                    ok: false,
                    kind: 'ambiguous',
                    error: `Heard multiple drinks (${names}) — please say just one drink per command.`
                };
            }
            const peopleFailure = splitResults.find(r => r.peopleResult && !r.peopleResult.ok);
            if (peopleFailure) return peopleFailure.peopleResult;
            const drinkFailure = splitResults.find(r => r.drinkCandidates.length === 0);
            if (drinkFailure) {
                return {
                    ok: false,
                    kind: 'no-drink',
                    error: `Couldn't find a drink matching "${drinkFailure.split.left}" in this cruise`
                };
            }
            return {
                ok: false,
                kind: 'no-match',
                error: 'Could not parse the phrase'
            };
        }

        // Tied top drink candidates → ambiguous.
        const top = best.drinkCandidates[0].score;
        const ties = best.drinkCandidates.filter(c => c.score === top);
        if (ties.length > 1) {
            const names = ties.map(t => t.drink.name).join(', ');
            return {
                ok: false,
                kind: 'ambiguous',
                error: `Could be ${names} — please be more specific`
            };
        }

        return {
            ok: true,
            drink: best.drinkCandidates[0].drink,
            people: best.peopleResult.people
        };
    }

    // Expose for both browser (window) and CommonJS (tests).
    const api = { parseVoiceCommand, _internal: { normalize, stripLeadingFillers, stripLeadingQuantity, findConnectorSplits, scoreDrinks, matchPeople, detectMultiDrink } };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.VoiceParser = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
