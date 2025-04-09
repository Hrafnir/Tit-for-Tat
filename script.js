document.addEventListener('DOMContentLoaded', () => {
    // === Globale Variabler og Tilstand ===
    let gameState = createInitialGameState();
    let allStrategies = createInitialStrategies();
    let gameLoopInterval = null;

    // --- DOM Element Referanser (VIKTIG: flyttet til *etter* funksjonsdefinisjoner) ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // Konfig
    const p1TypeSelect = $('#p1-type');
    const p2TypeSelect = $('#p2-type');
    const p1StrategySelect = $('#p1-strategy');
    const p2StrategySelect = $('#p2-strategy');
    const p1AiOptions = $('.ai-options.p1');
    const p2AiOptions = $('.ai-options.p2');
    const roundsInput = $('#rounds-setting');
    const noiseInput = $('#noise-level-setting');
    const resetGameBtn = $('#reset-game-btn');
    // Spillvisning
    const gameSection = $('.game-section');
    const roundCounterSpan = $('#round-counter');
    const totalRoundsDisplaySpan = $('#total-rounds-display');
    const noiseDisplaySpan = $('#noise-display');
    const p1IdSpan = $('.p1-id');
    const p2IdSpan = $('.p2-id');
    const p1ScoreSpan = $('#p1-score');
    const p2ScoreSpan = $('#p2-score');
    const p1AvgScoreSpan = $('#p1-avg-score');
    const p2AvgScoreSpan = $('#p2-avg-score');
    const p1HumanControls = $('.human-controls.p1');
    const p2HumanControls = $('.human-controls.p2');
    const p1StrategyNameP = $('.p1-strategy-name');
    const p2StrategyNameP = $('.p2-strategy-name');
    const p1ChoiceBtns = $$('.choice-btn.p1');
    const p2ChoiceBtns = $$('.choice-btn.p2');
    const p1ChosenSpan = $('.action-display.p1 .chosen');
    const p2ChosenSpan = $('.action-display.p2 .chosen');
    const playStepBtn = $('#play-step-btn');
    const play10Btn = $('#play-10-btn');
    const play100Btn = $('#play-100-btn');
    const playAllBtn = $('#play-all-btn');
    const playSpeedSlider = $('#play-speed');
    const speedValueSpan = $('#speed-value');
    const historyList = $('#history-list');
    const gameOverMessage = $('.game-over-message');
    const customAgentNameInput = $('#custom-agent-name');
    const ruleFirstMoveRadios = document.querySelectorAll('input[name="rule-first"]');
    const ruleOppCRadios = document.querySelectorAll('input[name="rule-opp-c"]');
    const ruleOppDRadios = document.querySelectorAll('input[name="rule-opp-d"]');
    const addRuleAgentBtn = $('#add-rule-agent-btn');
    const tournamentAgentListDiv = $('#tournament-agent-list');
    const startTournamentBtn = $('#start-tournament-btn');
    const tournamentStatusDiv = $('#tournament-status');
    const tournamentResultsContainer = $('.tournament-results');
    const tournamentResultsTableBody = $('.tournament-results-table tbody');


    // === Initialiseringsfunksjoner ===
    function createInitialGameState() {
        return {
            p1: { id: 1, score: 0, type: 'ai', strategyKey: 'titForTat', choice: null, intendedChoice: null, errored: false },
            p2: { id: 2, score: 0, type: 'ai', strategyKey: 'alwaysDefect', choice: null, intendedChoice: null, errored: false },
            history: [],
            currentRound: 0,
            totalRounds: 200,
            noiseLevel: 0,
            payoffs: {
                'C': { 'C': { p1: 3, p2: 3 }, 'D': { p1: 0, p2: 5 } },
                'D': { 'C': { p1: 5, p2: 0 }, 'D': { p1: 1, p2: 1 } }
            },
            gameInterval: null,
            playSpeed: 200,
            humanPlayer1ChoiceMade: false,
            humanPlayer2ChoiceMade: false,
            isGameOver: true, // Start som "ikke i gang"
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
                    const opponentLastMove = oppH[oppHistory.length - 1].choice;
                    return (opponentLastMove === 'C' && Math.random() < 0.1) ? 'D' : opponentLastMove;
                }
            },
            titForTwoTats: {
                name: "Tit For Two Tats (TFT2T)", isCustom: false, isRuleBased: false,
                fn: (myH, oppH) => {
                    if (oppH.length < 2) return 'C';
                    return (oppH[oppH.length - 1].choice === 'D' && oppH[oppHistory.length - 2].choice === 'D') ? 'D' : 'C';
                }
            },
           generousTitForTat: {
               name: "Generous Tit For Tat (GTFT ~10%)", isCustom: false, isRuleBased: false,
               fn: (myH, oppH) => {
                   if (oppH.length === 0) return 'C';
                   const opponentLastMove = oppH[oppHistory.length - 1].choice;
                   return (opponentLastMove === 'D' && Math.random() < 0.1) ? 'C' : opponentLastMove;
               }
           },
             tester: {
                name: "Tester", isCustom: false, isRuleBased: false, state: { opponentRetaliated: false, tested: false },
                fn: function(myH, oppH) {
                    if (myH.length === 0) {
                        this.state.tested = true; return 'D';
                    }
                     // Sjekk motstanderens svar på vårt første trekk (D)
                    if (myH.length === 1 && this.state.tested) {
                        if (oppH[0].choice === 'D') { // De straffet
                            this.state.opponentRetaliated = true;
                        }
                         // Samarbeid i andre runde uansett for å signalisere (eller "unnskylde")
                        return 'C';
                    }
                     // Langsiktig strategi basert på testen
                     if (this.state.opponentRetaliated) {
                         // Hvis de straffet, spill TFT fra nå av
                         return oppH.length > 0 ? oppH[oppHistory.length - 1].choice : 'C';
                     } else {
                         // Hvis de *ikke* straffet (var snille mot vår D), utnytt dem!
                         return 'D';
                     }
                 },
                 reset: function() { this.state.opponentRetaliated = false; this.state.tested = false; }
            }
        };
         // Bind 'this' for stateful methods if needed
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
        const currentValue = selectElement.value; // Husk valgt verdi hvis den finnes
        selectElement.innerHTML = '';
        const sortedKeys = Object.keys(allStrategies).sort((a, b) => allStrategies[a].name.localeCompare(allStrategies[b].name));
        sortedKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
            selectElement.appendChild(option);
        });
        // Sett tilbake valgt verdi eller default
        if (allStrategies[currentValue]) {
            selectElement.value = currentValue;
        } else if (allStrategies[defaultKey]) {
            selectElement.value = defaultKey;
        } else if (selectElement.options.length > 0) {
            selectElement.selectedIndex = 0; // Fallback til første
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
              // Velg alle predefinerte + evt. egne som allerede er valgt
             checkbox.checked = !allStrategies[key].isCustom || checkbox.checked;
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
        gameSection.classList.toggle('hidden', gameState.isGameOver || gameState.isTournamentRunning);
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

            // Status og poeng
            roundCounterSpan.textContent = gameState.currentRound;
            totalRoundsDisplaySpan.textContent = gameState.totalRounds;
            noiseDisplaySpan.textContent = gameState.noiseLevel;
            p1ScoreSpan.textContent = gameState.p1.score;
            p2ScoreSpan.textContent = gameState.p2.score;
            p1AvgScoreSpan.textContent = (gameState.currentRound > 0 ? (gameState.p1.score / gameState.currentRound) : 0).toFixed(2);
            p2AvgScoreSpan.textContent = (gameState.currentRound > 0 ? (gameState.p2.score / gameState.currentRound) : 0).toFixed(2);

            // Siste valg
            if (gameState.history.length > 0) {
                const last = gameState.history[gameState.history.length - 1];
                p1ChosenSpan.textContent = last.p1Choice;
                p1ChosenSpan.className = `chosen ${last.p1Choice === 'C' ? 'cooperate' : 'defect'} ${last.p1Errored ? 'error' : ''}`;
                p1ChosenSpan.title = last.p1Errored ? `Intensjon var ${last.p1Intended}` : '';
                p2ChosenSpan.textContent = last.p2Choice;
                p2ChosenSpan.className = `chosen ${last.p2Choice === 'C' ? 'cooperate' : 'defect'} ${last.p2Errored ? 'error' : ''}`;
                p2ChosenSpan.title = last.p2Errored ? `Intensjon var ${last.p2Intended}` : '';
            } else {
                p1ChosenSpan.textContent = '?'; p1ChosenSpan.className = 'chosen'; p1ChosenSpan.title = '';
                p2ChosenSpan.textContent = '?'; p2ChosenSpan.className = 'chosen'; p2ChosenSpan.title = '';
            }

            // Aktiver/deaktiver spillkontrollknapper
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

          // Turnering-spesifikke oppdateringer (kan utvides senere)
         startTournamentBtn.disabled = gameState.isTournamentRunning;
         startTournamentBtn.textContent = gameState.isTournamentRunning ? "Kjører..." : "Kjør Turnering";
    }


    // === Historikk & Resultatvisning ===
    function updateHistoryList() {
        historyList.innerHTML = '';
        const displayCount = 15;
        const startIndex = Math.max(0, gameState.history.length - displayCount);
        for (let i = startIndex; i < gameState.history.length; i++) {
            const d = gameState.history[i];
            const li = document.createElement('li');
            const p1C = d.p1Choice === 'C' ? 'history-choice-C' : 'history-choice-D';
            const p2C = d.p2Choice === 'C' ? 'history-choice-C' : 'history-choice-D';
            const p1E = d.p1Errored ? `<span class="history-error-indicator">(${d.p1Intended})</span>` : '';
            const p2E = d.p2Errored ? `<span class="history-error-indicator">(${d.p2Intended})</span>` : '';

            li.innerHTML = `
                <span class="history-round">R${d.round}:</span>
                <span class="history-p1">P1:<span class="${p1C}">${d.p1Choice}</span>${p1E} <span class="history-score">(+${d.p1Score})</span></span>
                <span class="history-p2">P2:<span class="${p2C}">${d.p2Choice}</span>${p2E} <span class="history-score">(+${d.p2Score})</span></span>
            `;
            historyList.appendChild(li);
        }
        historyList.scrollTop = historyList.scrollHeight;
    }

      function displayTournamentResults(scores, numAgents, roundsPerGame) {
          const results = [];
          for (const key in scores) {
               const averageScore = scores[key] / (numAgents * roundsPerGame);
               results.push({ key: key, name: allStrategies[key]?.name ?? `Ukjent (${key})`, average: averageScore });
           }
          results.sort((a, b) => b.average - a.average);

          tournamentResultsTableBody.innerHTML = '';
          results.forEach((result, index) => {
              const row = tournamentResultsTableBody.insertRow();
              row.innerHTML = `<td>${index + 1}</td><td>${result.name}${allStrategies[result.key]?.isCustom ? ' (Egen)' : ''}</td><td>${result.average.toFixed(2)}</td>`;
          });
           tournamentResultsContainer.classList.remove('hidden');
      }


    // === Spilllogikk === (Samme som før, antar den er korrekt)
     function getAgentChoice(agentState, opponentState, history) { /* ... som før ... */}
     function applyNoise(intendedChoice, noisePercent) { /* ... som før ... */}
     function executeRound() { /* ... som før ... */}
     function playSingleStep() { /* ... som før ... */}
     function playMultipleSteps(steps) { /* ... som før ... */}
     function togglePlayAll() { /* ... som før ... */}
     function resetGame() { /* ... som før ... */}

     function addRuleBasedAgent() {
         const name = customAgentNameInput.value.trim();
         const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_{2,}/g, '_') + '_' + Date.now();

         if (!name) { alert("Vennligst gi agenten et navn."); return; }
         if (Object.values(allStrategies).some(s => s.name === name)) {
             alert(`En agent med navnet "${name}" (eller lignende nøkkel '${key}') finnes allerede.`); return;
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

     async function runTournament() { /* ... som før ... */}
     function displayTournamentResults(tournamentScores, numAgents, roundsPerGame) { /* ... som før ... */}


    // === Event Listeners === (Kobler til alle knapper og dropdowns)
    resetGameBtn.addEventListener('click', resetGame);

    p1TypeSelect.addEventListener('change', resetGame);
    p2TypeSelect.addEventListener('change', resetGame);
    p1StrategySelect.addEventListener('change', () => { gameState.p1.strategyKey = p1StrategySelect.value; updateUI(); });
    p2StrategySelect.addEventListener('change', () => { gameState.p2.strategyKey = p2StrategySelect.value; updateUI(); });
    roundsInput.addEventListener('change', () => { gameState.totalRounds = parseInt(roundsInput.value) || 200; updateUI(); });
    noiseInput.addEventListener('change', () => { gameState.noiseLevel = parseInt(noiseInput.value) || 0; updateUI(); });

    p1ChoiceBtns.forEach(button => button.addEventListener('click', (e) => {
        if (!gameState.isGameOver && gameState.p1.type === 'human' && !gameState.humanPlayer1ChoiceMade) {
            gameState.p1.choice = button.dataset.choice;
            gameState.humanPlayer1ChoiceMade = true;
            p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            updateUI();
        }
    }));
    p2ChoiceBtns.forEach(button => button.addEventListener('click', (e) => {
        if (!gameState.isGameOver && gameState.p2.type === 'human' && !gameState.humanPlayer2ChoiceMade) {
            gameState.p2.choice = button.dataset.choice;
            gameState.humanPlayer2ChoiceMade = true;
            p2ChoiceBtns.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            updateUI();
        }
    }));

    playStepBtn.addEventListener('click', playSingleStep);
    play10Btn.addEventListener('click', () => playMultipleSteps(10));
    play100Btn.addEventListener('click', () => playMultipleSteps(100));
    playAllBtn.addEventListener('click', togglePlayAll);
    playSpeedSlider.addEventListener('input', (e) => {
        gameState.playSpeed = parseInt(e.target.value);
        speedValueSpan.textContent = gameState.playSpeed;
        if (gameState.isAutoPlaying) {
            clearInterval(gameLoopInterval);
            togglePlayAll();
        }
    });

    addRuleAgentBtn.addEventListener('click', addRuleBasedAgent);
    startTournamentBtn.addEventListener('click', runTournament);
    $('#show-settings-btn-game')?.addEventListener('click', resetGame);
    $('#show-settings-btn-tournament')?.addEventListener('click', resetGame);


    // === Initialisering ===
    initializeApp();

});
