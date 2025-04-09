document.addEventListener('DOMContentLoaded', () => {
    // === Globale Variabler og Tilstand ===
    let gameState; // Initialiseres av resetGame
    let allStrategies = createInitialStrategies();
    let gameLoopInterval = null; // For auto-spilling

    // --- DOM Element Referanser ---
    // (Henter alle elementene som før, bruker variabler definert i forrige svar)
    const configColumn = document.querySelector('.config-column');
    const p1TypeSelect = document.getElementById('p1-type');
    const p2TypeSelect = document.getElementById('p2-type');
    const p1StrategySelect = document.getElementById('p1-strategy');
    const p2StrategySelect = document.getElementById('p2-strategy');
    const p1AiOptions = document.querySelector('.ai-options.p1');
    const p2AiOptions = document.querySelector('.ai-options.p2');
    const roundsInput = document.getElementById('rounds-setting');
    const noiseInput = document.getElementById('noise-level-setting');
    const resetGameBtn = document.getElementById('reset-game-btn');
    const gameSection = document.querySelector('.game-section');
    const roundCounterSpan = document.getElementById('round-counter');
    const totalRoundsDisplaySpan = document.getElementById('total-rounds-display');
    const noiseDisplaySpan = document.getElementById('noise-display');
    const p1IdSpan = document.querySelector('.p1-id');
    const p2IdSpan = document.querySelector('.p2-id');
    const p1ScoreSpan = document.getElementById('p1-score');
    const p2ScoreSpan = document.getElementById('p2-score');
    const p1AvgScoreSpan = document.getElementById('p1-avg-score');
    const p2AvgScoreSpan = document.getElementById('p2-avg-score');
    const p1HumanControls = document.querySelector('.human-controls.p1');
    const p2HumanControls = document.querySelector('.human-controls.p2');
    const p1StrategyNameP = document.querySelector('.p1-strategy-name');
    const p2StrategyNameP = document.querySelector('.p2-strategy-name');
    const p1ChoiceBtns = document.querySelectorAll('.choice-btn.p1');
    const p2ChoiceBtns = document.querySelectorAll('.choice-btn.p2');
    const p1ChosenSpan = document.querySelector('.action-display.p1 .chosen');
    const p2ChosenSpan = document.querySelector('.action-display.p2 .chosen');
    const playStepBtn = document.getElementById('play-step-btn');
    const play10Btn = document.getElementById('play-10-btn');
    const play100Btn = document.getElementById('play-100-btn');
    const playAllBtn = document.getElementById('play-all-btn');
    const playSpeedSlider = document.getElementById('play-speed');
    const speedValueSpan = document.getElementById('speed-value');
    const historyList = document.getElementById('history-list');
    const gameOverMessage = document.querySelector('.game-over-message');
    const customAgentNameInput = document.getElementById('custom-agent-name');
    const ruleFirstMoveRadios = document.querySelectorAll('input[name="rule-first"]');
    const ruleOppCRadios = document.querySelectorAll('input[name="rule-opp-c"]');
    const ruleOppDRadios = document.querySelectorAll('input[name="rule-opp-d"]');
    const addRuleAgentBtn = document.getElementById('add-rule-agent-btn');
    const tournamentAgentListDiv = document.getElementById('tournament-agent-list');
    const startTournamentBtn = document.getElementById('start-tournament-btn');
    const tournamentStatusDiv = document.getElementById('tournament-status');
    const tournamentResultsContainer = document.querySelector('.tournament-results');
    const tournamentResultsTableBody = document.querySelector('#tournament-results-table tbody');


    // === Initialiseringsfunksjoner ===
    function createInitialGameState() {
        return {
            p1: { id: 1, score: 0, type: 'ai', strategyKey: 'titForTat', choice: null, intendedChoice: null, errored: false },
            p2: { id: 2, score: 0, type: 'ai', strategyKey: 'alwaysDefect', choice: null, intendedChoice: null, errored: false },
            history: [],
            currentRound: 0,
            totalRounds: 200,
            noiseLevel: 0,
            payoffs: { // Holder payoff-matrisen konstant her
                'C': { 'C': { p1: 3, p2: 3 }, 'D': { p1: 0, p2: 5 } },
                'D': { 'C': { p1: 5, p2: 0 }, 'D': { p1: 1, p2: 1 } }
            },
            gameInterval: null,
            playSpeed: 200,
            humanPlayer1ChoiceMade: false,
            humanPlayer2ChoiceMade: false,
            isGameOver: true, // VIKTIG: Start som 'game over' for å vise config
            isAutoPlaying: false,
            isTournamentRunning: false
        };
    }

    function createInitialStrategies() {
        let baseStrategies = {
             alwaysCooperate: { name: "Alltid Samarbeid", isCustom: false, isRuleBased: false, fn: (myH, oppH) => 'C' },
             alwaysDefect: { name: "Alltid Svik", isCustom: false, isRuleBased: false, fn: (myH, oppH) => 'D' },
             randomChoice: { name: "Tilfeldig", isCustom: false, isRuleBased: false, fn: (myH, oppH) => Math.random() < 0.5 ? 'C' : 'D' },
             titForTat: {
                 name: "Tit For Tat (TFT)", isCustom: false, isRuleBased: false,
                 fn: (myH, oppH) => oppH.length === 0 ? 'C' : oppH[oppH.length - 1].choice
             },
             grimTrigger: {
                 name: "Grim Trigger", isCustom: false, isRuleBased: false, state: { triggered: false },
                 fn: function(myH, oppH) {
                     if (this.state.triggered) return 'D';
                     if (oppH.length > 0 && oppH[oppH.length - 1].choice === 'D') {
                         this.state.triggered = true;
                         return 'D';
                     }
                     return 'C';
                 },
                 reset: function() { this.state.triggered = false; }
             },
             joss: {
                name: "Joss (Sleip TFT)", isCustom: false, isRuleBased: false,
                 fn: (myH, oppH) => {
                     if (oppH.length === 0) return 'C';
                     const opponentLastMove = oppH[oppH.length - 1].choice;
                     return (opponentLastMove === 'C' && Math.random() < 0.1) ? 'D' : opponentLastMove;
                 }
             },
             titForTwoTats: {
                 name: "Tit For Two Tats (TFT2T)", isCustom: false, isRuleBased: false,
                 fn: (myH, oppH) => {
                     if (oppH.length < 2) return 'C';
                     return (oppH[oppH.length - 1].choice === 'D' && oppH[oppH.length - 2].choice === 'D') ? 'D' : 'C';
                 }
             },
            generousTitForTat: {
                name: "Generous Tit For Tat (GTFT ~10%)", isCustom: false, isRuleBased: false,
                fn: (myH, oppH) => {
                    if (oppH.length === 0) return 'C';
                    const opponentLastMove = oppH[oppH.length - 1].choice;
                    return (opponentLastMove === 'D' && Math.random() < 0.1) ? 'C' : opponentLastMove;
                }
            },
              tester: {
                 name: "Tester", isCustom: false, isRuleBased: false, state: { opponentRetaliated: false, tested: false },
                 fn: function(myH, oppH) {
                     if (myH.length === 0) {
                         this.state.tested = true; return 'D';
                     }
                     if (myH.length === 1 && this.state.tested) {
                         if (oppH[0].choice === 'D') this.state.opponentRetaliated = true;
                         return 'C'; // Unnskyld / vær snill i runde 2
                     }
                     if (this.state.opponentRetaliated) {
                         return oppH.length > 0 ? oppH[oppH.length - 1].choice : 'C'; // Spill TFT
                     } else {
                         return 'D'; // Utnytt
                     }
                  },
                  reset: function() { this.state.opponentRetaliated = false; this.state.tested = false; }
             }
        };
        // Bind reset-metoder
        if (baseStrategies.grimTrigger) baseStrategies.grimTrigger.reset = baseStrategies.grimTrigger.reset.bind(baseStrategies.grimTrigger);
        if (baseStrategies.tester) baseStrategies.tester.reset = baseStrategies.tester.reset.bind(baseStrategies.tester);
        return baseStrategies;
    }

    // === Hjelpefunksjoner ===
    function getSelectedRadioValue(radioGroupName) {
        const selected = document.querySelector(`input[name="${radioGroupName}"]:checked`);
        return selected ? selected.value : null;
    }

    function createRuleBasedAgentFn(rules) {
        return function(myHistory, oppHistory) {
            if (oppHistory.length === 0) return rules.firstMove;
            const opponentLastChoice = oppHistory[oppHistory.length - 1].choice;
            return opponentLastChoice === 'C' ? rules.afterOpponentC : rules.afterOpponentD;
        };
    }

    function populateSelect(selectElement, defaultKey) {
        const currentVal = selectElement.value; // Remember current value
        selectElement.innerHTML = '';
        const sortedKeys = Object.keys(allStrategies).sort((a, b) => allStrategies[a].name.localeCompare(allStrategies[b].name));
        sortedKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
            selectElement.appendChild(option);
        });
        // Try to restore previous value, else set default, else first option
        if (allStrategies[currentVal]) {
            selectElement.value = currentVal;
        } else if (allStrategies[defaultKey]) {
            selectElement.value = defaultKey;
        } else if (selectElement.options.length > 0) {
            selectElement.selectedIndex = 0;
        }
    }

    function populateStrategyDropdowns() {
        populateSelect(p1StrategySelect, 'titForTat');
        populateSelect(p2StrategySelect, 'alwaysDefect');
    }

    function populateTournamentAgentList() {
        tournamentAgentListDiv.innerHTML = '';
        const sortedKeys = Object.keys(allStrategies).sort((a, b) => allStrategies[a].name.localeCompare(allStrategies[b].name));
        sortedKeys.forEach(key => {
            const div = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `ts-${key}`;
            checkbox.value = key;
            checkbox.checked = !allStrategies[key].isCustom; // Default pre-defined to checked
            const label = document.createElement('label');
            label.htmlFor = `ts-${key}`;
            label.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
            div.appendChild(checkbox);
            div.appendChild(label);
            tournamentAgentListDiv.appendChild(div);
        });
    }

    // === UI Oppdateringsfunksjon (Revidert) ===
    function updateUI() {
        const canStartNewGame = gameState.isGameOver && !gameState.isTournamentRunning;

        // --- Synlighet av Seksjoner ---
        configColumn.style.display = canStartNewGame ? 'flex' : 'none';
        gameSection.classList.toggle('hidden', !(!gameState.isGameOver && !gameState.isTournamentRunning)); // Vis kun når spill pågår
        tournamentResultsContainer.classList.toggle('hidden', gameState.isTournamentRunning || tournamentResultsTableBody.innerHTML === '');
        tournamentStatusDiv.classList.toggle('hidden', !gameState.isTournamentRunning);
        gameOverMessage.classList.toggle('hidden', gameState.isTournamentRunning || gameState.currentRound === 0 || !gameState.isGameOver);

        // --- Konfigurasjons-UI (kun relevant når canStartNewGame er true) ---
        if (canStartNewGame) {
            p1AiOptions.style.display = p1TypeSelect.value === 'ai' ? 'flex' : 'none';
            p2AiOptions.style.display = p2TypeSelect.value === 'ai' ? 'flex' : 'none';
        }

        // --- Spill-UI (kun relevant når spillet pågår) ---
        if (!gameState.isGameOver && !gameState.isTournamentRunning) {
            const isP1Human = gameState.p1.type === 'human';
            const isP2Human = gameState.p2.type === 'human';

            // Panel ID/Navn
            p1IdSpan.textContent = isP1Human ? 'Menneske' : 'AI';
            p2IdSpan.textContent = isP2Human ? 'Menneske' : 'AI';
            p1StrategyNameP.textContent = !isP1Human && gameState.p1.strategyKey ? allStrategies[gameState.p1.strategyKey].name : '';
            p2StrategyNameP.textContent = !isP2Human && gameState.p2.strategyKey ? allStrategies[gameState.p2.strategyKey].name : '';
            p1StrategyNameP.classList.toggle('hidden', isP1Human);
            p2StrategyNameP.classList.toggle('hidden', isP2Human);

            // Menneske-kontroller
            p1HumanControls.classList.toggle('hidden', !isP1Human);
            p2HumanControls.classList.toggle('hidden', !isP2Human);

            // Status/Poeng
            roundCounterSpan.textContent = gameState.currentRound;
            totalRoundsDisplaySpan.textContent = gameState.totalRounds;
            noiseDisplaySpan.textContent = gameState.noiseLevel;
            p1ScoreSpan.textContent = gameState.p1.score;
            p2ScoreSpan.textContent = gameState.p2.score;
            p1AvgScoreSpan.textContent = (gameState.currentRound > 0 ? (gameState.p1.score / gameState.currentRound) : 0).toFixed(2);
            p2AvgScoreSpan.textContent = (gameState.currentRound > 0 ? (gameState.p2.score / gameState.currentRound) : 0).toFixed(2);

            // Siste valg display
            if (gameState.history.length > 0) {
                const last = gameState.history[gameState.history.length - 1];
                p1ChosenSpan.textContent = last.p1Choice;
                p1ChosenSpan.className = `chosen ${last.p1Choice === 'C' ? 'cooperate' : 'defect'} ${last.p1Errored ? 'error' : ''}`;
                p1ChosenSpan.title = last.p1Errored ? `Intensjon: ${last.p1Intended}` : '';
                p2ChosenSpan.textContent = last.p2Choice;
                p2ChosenSpan.className = `chosen ${last.p2Choice === 'C' ? 'cooperate' : 'defect'} ${last.p2Errored ? 'error' : ''}`;
                p2ChosenSpan.title = last.p2Errored ? `Intensjon: ${last.p2Intended}` : '';
            } else {
                p1ChosenSpan.textContent = '?'; p1ChosenSpan.className = 'chosen'; p1ChosenSpan.title = '';
                p2ChosenSpan.textContent = '?'; p2ChosenSpan.className = 'chosen'; p2ChosenSpan.title = '';
            }

            // Spillkontroll-knapper
            const p1Ready = !isP1Human || gameState.humanPlayer1ChoiceMade;
            const p2Ready = !isP2Human || gameState.humanPlayer2ChoiceMade;
            playStepBtn.disabled = !(p1Ready && p2Ready) || gameState.isAutoPlaying;
            const canAuto = !isP1Human && !isP2Human;
            play10Btn.disabled = !canAuto || gameState.isAutoPlaying;
            play100Btn.disabled = !canAuto || gameState.isAutoPlaying;
            playAllBtn.disabled = !canAuto;
            playAllBtn.textContent = gameState.isAutoPlaying ? "Stopp" : "Kjør Resten";

            // Nullstill 'selected' klasse hvis et menneske ikke har valgt ennå
             if (isP1Human && !gameState.humanPlayer1ChoiceMade) p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
             if (isP2Human && !gameState.humanPlayer2ChoiceMade) p2ChoiceBtns.forEach(b => b.classList.remove('selected'));

        } else {
            // Deaktiver spillkontroller når spillet ikke pågår
            playStepBtn.disabled = true;
            play10Btn.disabled = true;
            play100Btn.disabled = true;
            playAllBtn.disabled = true;
        }

         // Turneringsknapp
         startTournamentBtn.disabled = gameState.isTournamentRunning;
         startTournamentBtn.textContent = gameState.isTournamentRunning ? "Kjører..." : "Kjør Turnering";
    }


    // === Historikk & Resultatvisning ===
    function updateHistoryList() {
        historyList.innerHTML = ''; // Tøm og bygg opp de siste N
        const displayCount = 15; // Vis færre for oversikt
        const startIndex = Math.max(0, gameState.history.length - displayCount);
        for (let i = startIndex; i < gameState.history.length; i++) {
            const d = gameState.history[i]; // Kortere variabelnavn
            const li = document.createElement('li');
            const p1C = d.p1Choice === 'C' ? 'history-choice-C' : 'history-choice-D';
            const p2C = d.p2Choice === 'C' ? 'history-choice-C' : 'history-choice-D';
            const p1E = d.p1Errored ? `<span class="history-error-indicator">(${d.p1Intended})</span>` : '';
            const p2E = d.p2Errored ? `<span class="history-error-indicator">(${d.p2Intended})</span>` : '';
            li.innerHTML = `<span class="history-round">R${d.round}:</span> <span class="history-p1">P1:<span class="${p1C}">${d.p1Choice}</span>${p1E}<span class="history-score">(+${d.p1Score})</span></span> <span class="history-p2">P2:<span class="${p2C}">${d.p2Choice}</span>${p2E}<span class="history-score">(+${d.p2Score})</span></span>`;
            historyList.appendChild(li);
        }
        historyList.scrollTop = historyList.scrollHeight;
    }

     function displayTournamentResults(scores, numAgents, roundsPerGame) {
         const results = Object.entries(scores).map(([key, totalScore]) => ({
             key,
             name: allStrategies[key]?.name ?? `Ukjent (${key})`,
             average: totalScore / (numAgents * roundsPerGame) // Snitt over alle spill
         }));
         results.sort((a, b) => b.average - a.average); // Sorter synkende

         tournamentResultsTableBody.innerHTML = '';
         results.forEach((result, index) => {
             const row = tournamentResultsTableBody.insertRow();
             row.innerHTML = `<td>${index + 1}</td><td>${result.name}${allStrategies[result.key]?.isCustom ? ' (Egen)' : ''}</td><td>${result.average.toFixed(2)}</td>`;
         });
         tournamentResultsContainer.classList.remove('hidden');
     }

    // === Spilllogikk ===
    function getAgentChoice(agentState, opponentState, history) {
        if (agentState.type === 'human') return agentState.choice; // Forutsetter at 'choice' er satt

        const strategy = allStrategies[agentState.strategyKey];
        if (!strategy?.fn) { console.error("Missing strategy fn:", agentState.strategyKey); return 'C'; }

        try {
            const myHistory = history.map(h => agentState.id === 1 ? { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored } : { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored });
            const oppHistory = history.map(h => agentState.id === 1 ? { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored } : { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored });
            let choice;
            // Bruk .call for å gi 'this' kontekst til stateful strategier
            if (strategy.state && typeof strategy.fn === 'function') {
                choice = strategy.fn.call(strategy, myHistory, oppHistory);
            } else if (typeof strategy.fn === 'function') {
                choice = strategy.fn(myHistory, oppHistory);
            } else { choice = 'C'; } // Fallback
            return (choice === 'C' || choice === 'D') ? choice : 'C'; // Valider
        } catch (e) { console.error(`Error in strategy ${agentState.strategyKey}:`, e); return 'C'; }
    }

    function applyNoise(intendedChoice, noisePercent) {
        const didError = Math.random() * 100 < noisePercent;
        const actualChoice = didError ? (intendedChoice === 'C' ? 'D' : 'C') : intendedChoice;
        return { choice: actualChoice, errored: didError, intended: intendedChoice };
    }

    function executeRound() {
        const p1Intended = getAgentChoice(gameState.p1, gameState.p2, gameState.history);
        const p2Intended = getAgentChoice(gameState.p2, gameState.p1, gameState.history);

        // Ekstra sjekk (bør ikke være nødvendig hvis UI-logikk er rett)
        if (!p1Intended || !p2Intended) {
             console.error("Forsøkte å kjøre runde uten at begge spillere var klare.");
             stopAutoPlay(); // Stopp auto hvis noe er galt
             return false; // Indikerer at runden ikke ble kjørt
        }

        const p1Result = applyNoise(p1Intended, gameState.noiseLevel);
        const p2Result = applyNoise(p2Intended, gameState.noiseLevel);
        const payoff = gameState.payoffs[p1Result.choice][p2Result.choice];

        gameState.p1.score += payoff.p1;
        gameState.p2.score += payoff.p2;
        gameState.currentRound++;

        gameState.history.push({
            round: gameState.currentRound,
            p1Choice: p1Result.choice, p1Intended: p1Result.intended, p1Errored: p1Result.errored,
            p2Choice: p2Result.choice, p2Intended: p2Result.intended, p2Errored: p2Result.errored,
            p1Score: payoff.p1, p2Score: payoff.p2
        });

        // Nullstill menneskelige valg
        gameState.p1.choice = null; gameState.humanPlayer1ChoiceMade = false;
        gameState.p2.choice = null; gameState.humanPlayer2ChoiceMade = false;

        if (gameState.currentRound >= gameState.totalRounds) {
            gameState.isGameOver = true;
            stopAutoPlay(); // Sørg for at auto-spill stopper
        }
         return true; // Indikerer at runden ble kjørt
    }

    function playSingleStep() {
        if (gameState.isGameOver || gameState.isTournamentRunning || gameState.isAutoPlaying) return;
        if (executeRound()) { // Kjør logikken
             updateUI(); // Oppdater UI etterpå
             updateHistoryList();
        } else {
            // Hvis executeRound feilet (f.eks. manglet menneskelig input), oppdater UI for å vise knappe-status
             updateUI();
        }
    }

    function playMultipleSteps(steps) {
        if (gameState.p1.type === 'human' || gameState.p2.type === 'human' || gameState.isTournamentRunning || gameState.isAutoPlaying) return;
        const targetRound = Math.min(gameState.totalRounds, gameState.currentRound + steps);
        let stepsPlayed = 0;
        while (gameState.currentRound < targetRound && !gameState.isGameOver) {
            if (!executeRound()) break; // Stopp hvis en runde feiler
             stepsPlayed++;
        }
        // Oppdater UI *etter* at alle stegene er kjørt for bedre ytelse
        if(stepsPlayed > 0) {
            updateUI();
            updateHistoryList();
        }
    }

    function stopAutoPlay() {
        if (gameLoopInterval) {
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
        }
        gameState.isAutoPlaying = false;
        // updateUI vil kalles etterpå uansett, så vi trenger ikke her.
    }

    function togglePlayAll() {
        if (gameState.p1.type === 'human' || gameState.p2.type === 'human' || gameState.isTournamentRunning) return;

        if (gameState.isAutoPlaying) {
            stopAutoPlay();
        } else {
            gameState.isAutoPlaying = true;
            gameLoopInterval = setInterval(() => {
                 if (!gameState.isGameOver) {
                     if (!executeRound()) { // Hvis en runde feiler (bør ikke skje med AI)
                         stopAutoPlay();
                         updateUI();
                     } else {
                         // Minimal UI-oppdatering under auto-spill for ytelse
                         roundCounterSpan.textContent = gameState.currentRound;
                         p1ScoreSpan.textContent = gameState.p1.score;
                         p2ScoreSpan.textContent = gameState.p2.score;
                         p1AvgScoreSpan.textContent = (gameState.p1.score / gameState.currentRound).toFixed(2);
                         p2AvgScoreSpan.textContent = (gameState.p2.score / gameState.currentRound).toFixed(2);
                         updateHistoryList(); // Oppdater historikk fortløpende
                     }
                 } else {
                     stopAutoPlay();
                     updateUI(); // Full oppdatering til slutt
                 }
            }, gameState.playSpeed);
        }
        updateUI(); // Oppdater knappetekst umiddelbart
    }

    // === Agent & Turneringslogikk ===
    function addRuleBasedAgent() {
        const name = customAgentNameInput.value.trim();
         // Lag en litt mer robust nøkkel
        const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_{2,}/g, '_') + '_' + Date.now();

        if (!name) { alert("Vennligst gi agenten et navn."); return; }
        if (Object.values(allStrategies).some(s => s.name === name)) {
             alert(`En agent med navnet "${name}" finnes allerede.`); return;
        }

        const rules = {
            firstMove: getSelectedRadioValue('rule-first'),
            afterOpponentC: getSelectedRadioValue('rule-opp-c'),
            afterOpponentD: getSelectedRadioValue('rule-opp-d')
        };

        if (!rules.firstMove || !rules.afterOpponentC || !rules.afterOpponentD) {
            alert("Velg regler for alle situasjoner."); return;
        }

        allStrategies[key] = { name, isCustom: true, isRuleBased: true, fn: createRuleBasedAgentFn(rules), rules };
        populateStrategyDropdowns();
        populateTournamentAgentList();
        customAgentNameInput.value = '';
        alert(`Agenten "${name}" ble lagt til!`);
    }

     async function runTournament() {
         if (gameState.isTournamentRunning || !gameState.isGameOver) {
             alert("Fullfør eller nullstill pågående spill/turnering først."); return;
         }
         const selectedAgentKeys = Array.from(tournamentAgentListDiv.querySelectorAll('input:checked')).map(cb => cb.value);
         if (selectedAgentKeys.length < 2) { alert("Velg minst to agenter."); return; }

         const roundsPerGame = parseInt(roundsInput.value) || 200;
         const noisePercent = parseInt(noiseInput.value) || 0;
         const tournamentScores = {};
         selectedAgentKeys.forEach(key => { tournamentScores[key] = 0; });

         gameState.isTournamentRunning = true;
         gameState.isGameOver = false; // Markerer at noe kjører
         startTournamentBtn.disabled = true;
         startTournamentBtn.textContent = "Kjører...";
         tournamentResultsContainer.classList.add('hidden');
         tournamentStatusDiv.classList.remove('hidden');
         updateUI(); // Skjul config, deaktiver spillknapper etc.

         const totalGamesToPlay = selectedAgentKeys.length * selectedAgentKeys.length;
         let gamesPlayed = 0;

         for (let i = 0; i < selectedAgentKeys.length; i++) {
             for (let j = 0; j < selectedAgentKeys.length; j++) {
                 gamesPlayed++;
                 const key1 = selectedAgentKeys[i];
                 const key2 = selectedAgentKeys[j];
                 tournamentStatusDiv.textContent = `Spill ${gamesPlayed}/${totalGamesToPlay}: ${allStrategies[key1].name} vs ${allStrategies[key2].name}`;

                 // Nullstill state FØR hvert spill
                 if (allStrategies[key1]?.reset) allStrategies[key1].reset();
                 if (allStrategies[key2]?.reset) allStrategies[key2].reset();

                 let p1ScoreThisGame = 0;
                 let p2ScoreThisGame = 0; // Trengs kun for != spill
                 let historyThisGame = [];

                 for (let r = 0; r < roundsPerGame; r++) {
                     const agent1State = { id: 1, type: 'ai', strategyKey: key1 };
                     const agent2State = { id: 2, type: 'ai', strategyKey: key2 };
                     const intendedP1 = getAgentChoice(agent1State, agent2State, historyThisGame);
                     const intendedP2 = getAgentChoice(agent2State, agent1State, historyThisGame);
                     const resultP1 = applyNoise(intendedP1, noisePercent);
                     const resultP2 = applyNoise(intendedP2, noisePercent);
                     const payoff = gameState.payoffs[resultP1.choice][resultP2.choice];
                     p1ScoreThisGame += payoff.p1;
                     if (i !== j) p2ScoreThisGame += payoff.p2; // Bare tell P2 hvis ikke mot seg selv
                     historyThisGame.push({ round: r + 1, p1Choice: resultP1.choice, p1Intended: resultP1.intended, p1Errored: resultP1.errored, p2Choice: resultP2.choice, p2Intended: resultP2.intended, p2Errored: resultP2.errored, p1Score: payoff.p1, p2Score: payoff.p2 });
                 }
                 tournamentScores[key1] += p1ScoreThisGame;
                 if (i !== j) tournamentScores[key2] += p2ScoreThisGame;

                 await new Promise(resolve => setTimeout(resolve, 0)); // Pustepause for UI
             }
         }

         displayTournamentResults(tournamentScores, selectedAgentKeys.length, roundsPerGame);
         gameState.isTournamentRunning = false;
         gameState.isGameOver = true;
         startTournamentBtn.disabled = false;
         startTournamentBtn.textContent = "Kjør Turnering";
         tournamentStatusDiv.classList.add('hidden');
         updateUI(); // Gå tilbake til config-visning
     }

    // === Initialiseringsrutine ===
    function initializeApp() {
        console.log("Initialiserer Dilemma Lab...");
        populateStrategyDropdowns();
        populateTournamentAgentList();
        gameState = createInitialGameState(); // Sett den initielle, "game over"-tilstanden
        updateUI(); // Vis konfigurasjonsgrensesnittet

        // --- Koble til Hendelseslyttere ---
        resetGameBtn.addEventListener('click', resetGame);
        p1TypeSelect.addEventListener('change', () => { gameState.p1.type = p1TypeSelect.value; updateUI(); }); // Oppdater UI umiddelbart
        p2TypeSelect.addEventListener('change', () => { gameState.p2.type = p2TypeSelect.value; updateUI(); });
        // Strategivalg trenger ikke reset game, bare oppdatere state for NESTE spill
        p1StrategySelect.addEventListener('change', () => { gameState.p1.strategyKey = p1StrategySelect.value; });
        p2StrategySelect.addEventListener('change', () => { gameState.p2.strategyKey = p2StrategySelect.value; });

        // Menneskelige valg
        p1ChoiceBtns.forEach(button => button.addEventListener('click', () => {
            if (!gameState.isGameOver && gameState.p1.type === 'human' && !gameState.humanPlayer1ChoiceMade) {
                gameState.p1.choice = button.dataset.choice;
                gameState.humanPlayer1ChoiceMade = true;
                p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
                button.classList.add('selected');
                updateUI();
            }
        }));
        p2ChoiceBtns.forEach(button => button.addEventListener('click', () => {
             if (!gameState.isGameOver && gameState.p2.type === 'human' && !gameState.humanPlayer2ChoiceMade) {
                gameState.p2.choice = button.dataset.choice;
                gameState.humanPlayer2ChoiceMade = true;
                p2ChoiceBtns.forEach(b => b.classList.remove('selected'));
                button.classList.add('selected');
                updateUI();
            }
        }));

        // Spillkontroller
        playStepBtn.addEventListener('click', playSingleStep);
        play10Btn.addEventListener('click', () => playMultipleSteps(10));
        play100Btn.addEventListener('click', () => playMultipleSteps(100));
        playAllBtn.addEventListener('click', togglePlayAll);
        playSpeedSlider.addEventListener('input', (e) => {
            gameState.playSpeed = parseInt(e.target.value);
            speedValueSpan.textContent = gameState.playSpeed;
            if (gameState.isAutoPlaying) { // Juster intervallet hvis det kjører
                clearInterval(gameLoopInterval);
                togglePlayAll(); // Starter det på nytt med ny fart
            }
        });

        // Agent og Turnering
        addRuleAgentBtn.addEventListener('click', addRuleBasedAgent);
        startTournamentBtn.addEventListener('click', runTournament);

        console.log("Dilemma Lab klar.");
    }

    // --- Kjør Initialisering ---
    initializeApp();

});
