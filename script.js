document.addEventListener('DOMContentLoaded', () => {
    // === Globale Variabler og Tilstand ===
    let gameState = createInitialGameState(); // Bruker funksjon for enkel nullstilling
    let allStrategies = createInitialStrategies(); // Samme her

    // --- DOM Element Referanser (hentet en gang) ---
    const configColumn = $('.config-column'); // Referanse til hele kolonnen
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
    // Egen Agent
    const customAgentNameInput = $('#custom-agent-name');
    const ruleFirstMoveRadios = document.querySelectorAll('input[name="rule-first"]');
    const ruleOppCRadios = document.querySelectorAll('input[name="rule-opp-c"]');
    const ruleOppDRadios = document.querySelectorAll('input[name="rule-opp-d"]');
    const addRuleAgentBtn = $('#add-rule-agent-btn');
    // Turnering
    const tournamentAgentListDiv = $('#tournament-agent-list');
    const startTournamentBtn = $('#start-tournament-btn');
    const tournamentStatusDiv = $('#tournament-status');
    const tournamentResultsContainer = $('.tournament-results');
    const tournamentResultsTableBody = $('#tournament-results-table tbody');

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
         // Sørg for at reset-funksjoner er bundet til riktig 'this' hvis de bruker 'this.state'
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
                    if (myH.length === 0) { // Første trekk
                        this.state.tested = true;
                        return 'D'; // Start with defection to test
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
                         return oppH.length > 0 ? oppH[oppH.length - 1].choice : 'C';
                     } else {
                         // Hvis de *ikke* straffet (var snille mot vår D), utnytt dem!
                         return 'D';
                     }
                 },
                 reset: function() { this.state.opponentRetaliated = false; this.state.tested = false; }
            }
        };
         // Bind 'this' for stateful methods if needed (although .call should handle it)
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

    function populateSelect(selectElement, defaultValueKey) {
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
        } else if (allStrategies[defaultValueKey]) {
             selectElement.value = defaultValueKey;
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

    // === UI Oppdateringsfunksjon ===
     function updateUI() {
        // Sjekk om spillet KAN startes (dvs. ikke allerede i gang, og ikke i turnering)
        const canStartNewGame = gameState.isGameOver && !gameState.isTournamentRunning;

        // Vis/skjul seksjoner
        configColumn.style.display = canStartNewGame ? 'flex' : 'none'; // Vis config kun når man kan starte nytt
        gameSection.classList.toggle('hidden', gameState.isGameOver || gameState.isTournamentRunning);
        tournamentResultsContainer.classList.toggle('hidden', gameState.isTournamentRunning || tournamentResultsTableBody.innerHTML === '');
        tournamentStatusDiv.classList.toggle('hidden', !gameState.isTournamentRunning);
        gameOverMessage.classList.toggle('hidden', !gameState.isGameOver || gameState.currentRound === 0 || gameState.isTournamentRunning);

        // Hvis spillet ikke er i gang, trenger vi ikke oppdatere resten
        if (gameState.isGameOver || gameState.isTournamentRunning) {
             // Sørg for at spillkontroller er deaktivert når spillet ikke kjører
             playStepBtn.disabled = true;
             play10Btn.disabled = true;
             play100Btn.disabled = true;
             playAllBtn.disabled = true;
             return;
        }

         // --- Oppdater spill-spesifikk UI ---
         const isP1Human = gameState.p1.type === 'human';
         const isP2Human = gameState.p2.type === 'human';

         // AI vs Menneske-spesifikke elementer
         p1AiOptions.style.display = isP1Human ? 'none' : 'flex';
         p2AiOptions.style.display = isP2Human ? 'none' : 'flex';
         p1HumanControls.classList.toggle('hidden', !isP1Human);
         p2HumanControls.classList.toggle('hidden', !isP2Human);
         p1StrategyNameP.textContent = !isP1Human && gameState.p1.strategyKey ? allStrategies[gameState.p1.strategyKey].name : '';
         p2StrategyNameP.textContent = !isP2Human && gameState.p2.strategyKey ? allStrategies[gameState.p2.strategyKey].name : '';
         p1StrategyNameP.classList.toggle('hidden', isP1Human);
         p2StrategyNameP.classList.toggle('hidden', isP2Human);
         p1IdSpan.textContent = isP1Human ? 'Menneske' : 'AI';
         p2IdSpan.textContent = isP2Human ? 'Menneske' : 'AI';

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
             const lastRound = gameState.history[gameState.history.length - 1];
             p1ChosenSpan.textContent = lastRound.p1Choice;
             p1ChosenSpan.className = `chosen ${lastRound.p1Choice === 'C' ? 'cooperate' : 'defect'} ${lastRound.p1Errored ? 'error' : ''}`;
             p1ChosenSpan.title = lastRound.p1Errored ? `Intensjon var ${lastRound.p1Intended}` : '';
             p2ChosenSpan.textContent = lastRound.p2Choice;
             p2ChosenSpan.className = `chosen ${lastRound.p2Choice === 'C' ? 'cooperate' : 'defect'} ${lastRound.p2Errored ? 'error' : ''}`;
             p2ChosenSpan.title = lastRound.p2Errored ? `Intensjon var ${lastRound.p2Intended}` : '';
         } else {
             p1ChosenSpan.textContent = '?'; p1ChosenSpan.className = 'chosen'; p1ChosenSpan.title = '';
             p2ChosenSpan.textContent = '?'; p2ChosenSpan.className = 'chosen'; p2ChosenSpan.title = '';
         }

         // Aktiver/deaktiver spillkontrollknapper
         const p1Ready = !isP1Human || gameState.humanPlayer1ChoiceMade;
         const p2Ready = !isP2Human || gameState.humanPlayer2ChoiceMade;
         playStepBtn.disabled = !p1Ready || !p2Ready || gameState.isAutoPlaying;
         const canAutoPlay = !isP1Human && !isP2Human;
         play10Btn.disabled = !canAutoPlay || gameState.isAutoPlaying;
         play100Btn.disabled = !canAutoPlay || gameState.isAutoPlaying;
         playAllBtn.disabled = !canAutoPlay;
         playAllBtn.textContent = gameState.isAutoPlaying ? "Stopp" : "Kjør Resten";

         // Nullstill valgt-klasse hvis menneskelig valg trengs
         if (isP1Human && !gameState.humanPlayer1ChoiceMade) p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
         if (isP2Human && !gameState.humanPlayer2ChoiceMade) p2ChoiceBtns.forEach(b => b.classList.remove('selected'));
     }

     // === Historikk & Resultatvisning ===
     function updateHistoryList() {
         historyList.innerHTML = ''; // Tøm og bygg opp de siste N
         const displayCount = 15;
         const startIndex = Math.max(0, gameState.history.length - displayCount);
         for (let i = startIndex; i < gameState.history.length; i++) {
             const roundData = gameState.history[i];
             const li = document.createElement('li');
             const p1ChoiceClass = roundData.p1Choice === 'C' ? 'history-choice-C' : 'history-choice-D';
             const p2ChoiceClass = roundData.p2Choice === 'C' ? 'history-choice-C' : 'history-choice-D';
             const p1Err = roundData.p1Errored ? `<span class="history-error-indicator">(var ${roundData.p1Intended})</span>` : '';
             const p2Err = roundData.p2Errored ? `<span class="history-error-indicator">(var ${roundData.p2Intended})</span>` : '';

             li.innerHTML = `
                 <span class="history-round">R${roundData.round}:</span>
                 <span class="history-p1">P1: <span class="${p1ChoiceClass}">${roundData.p1Choice}</span>${p1Err} <span class="history-score">(+${roundData.p1Score})</span></span>
                 <span class="history-p2">P2: <span class="${p2ChoiceClass}">${roundData.p2Choice}</span>${p2Err} <span class="history-score">(+${roundData.p2Score})</span></span>
             `;
             historyList.appendChild(li);
         }
         historyList.scrollTop = historyList.scrollHeight;
     }

      function displayTournamentResults(scores, numAgents, roundsPerGame) {
          const results = [];
          for (const key in scores) {
             // Gjennomsnitt = Total poengsum / (Antall motstandere (inkl seg selv) * Antall runder per spill)
             const averageScore = scores[key] / (numAgents * roundsPerGame);
             results.push({ key: key, name: allStrategies[key]?.name ?? `Ukjent (${key})`, average: averageScore });
          }

          results.sort((a, b) => b.average - a.average);

          tournamentResultsTableBody.innerHTML = '';
          results.forEach((result, index) => {
              const row = tournamentResultsTableBody.insertRow();
              row.innerHTML = `
                  <td>${index + 1}</td>
                  <td>${result.name}${allStrategies[result.key]?.isCustom ? ' (Egen)' : ''}</td>
                  <td>${result.average.toFixed(2)}</td>
              `;
          });
           tournamentResultsContainer.classList.remove('hidden');
      }


    // === Spilllogikk ===
    function getAgentChoice(agentState, opponentState, history) {
        if (agentState.type === 'human') {
            return agentState.choice; // Må være satt
        }
        const strategy = allStrategies[agentState.strategyKey];
        if (!strategy?.fn) return 'C'; // Fallback

        try {
            const myHistory = history.map(h => agentState.id === 1 ?
                { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored } :
                { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored }
            );
            const oppHistory = history.map(h => agentState.id === 1 ?
                { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored } :
                { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored }
            );

            let choice;
            if (strategy.state && typeof strategy.fn === 'function') {
                choice = strategy.fn.call(strategy, myHistory, oppHistory);
            } else if (typeof strategy.fn === 'function'){
                choice = strategy.fn(myHistory, oppHistory);
            } else {
                 choice = 'C'; // Fallback hvis fn ikke er en funksjon
            }

            return (choice === 'C' || choice === 'D') ? choice : 'C'; // Valider
        } catch (e) {
            console.error(`Feil i strategi ${agentState.strategyKey}:`, e);
            return 'C'; // Fallback
        }
    }

    function applyNoise(intendedChoice, noisePercent) {
        const didError = Math.random() * 100 < noisePercent;
        const actualChoice = didError ? (intendedChoice === 'C' ? 'D' : 'C') : intendedChoice;
        return { choice: actualChoice, errored: didError, intended: intendedChoice };
    }

    function playSingleStep() {
        if (gameState.isGameOver || gameState.isTournamentRunning || gameState.isAutoPlaying) return; // Ikke kjør manuelt steg under auto/turnering

         const p1Intended = getAgentChoice(gameState.p1, gameState.p2, gameState.history);
         const p2Intended = getAgentChoice(gameState.p2, gameState.p1, gameState.history);

        // Sjekk om menneskelige spillere er klare
         if ((gameState.p1.type === 'human' && !p1Intended) || (gameState.p2.type === 'human' && !p2Intended)) {
             console.warn("Venter på menneskelig(e) valg.");
             // Kanskje gi en visuell indikasjon til brukeren?
             return;
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

         // Nullstill for neste runde
         gameState.p1.choice = null; gameState.humanPlayer1ChoiceMade = false;
         gameState.p2.choice = null; gameState.humanPlayer2ChoiceMade = false;


         if (gameState.currentRound >= gameState.totalRounds) {
             gameState.isGameOver = true;
         }

         updateUI();
         updateHistoryList();
     }

    function playMultipleSteps(steps) {
         if (gameState.p1.type === 'human' || gameState.p2.type === 'human' || gameState.isTournamentRunning || gameState.isAutoPlaying) return;
         const targetRound = Math.min(gameState.totalRounds, gameState.currentRound + steps);
         while (gameState.currentRound < targetRound && !gameState.isGameOver) {
              // Trenger ikke sjekke human input her siden vi allerede har sjekket at begge er AI
              const p1Intended = getAgentChoice(gameState.p1, gameState.p2, gameState.history);
              const p2Intended = getAgentChoice(gameState.p2, gameState.p1, gameState.history);
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
              if (gameState.currentRound >= gameState.totalRounds) gameState.isGameOver = true;
         }
         updateUI();
         updateHistoryList();
     }

     function togglePlayAll() {
          if (gameState.p1.type === 'human' || gameState.p2.type === 'human' || gameState.isTournamentRunning) return;

         if (gameState.isAutoPlaying) {
             clearInterval(gameState.gameInterval);
             gameState.gameInterval = null;
             gameState.isAutoPlaying = false;
         } else {
             gameState.isAutoPlaying = true;
             gameState.gameInterval = setInterval(() => {
                 if (!gameState.isGameOver) {
                     playMultipleSteps(1); // Bruk multi-step for å unngå UI-oppdatering per steg
                 } else {
                     clearInterval(gameState.gameInterval);
                     gameState.gameInterval = null;
                     gameState.isAutoPlaying = false;
                     updateUI(); // Sluttoppdatering
                 }
             }, gameState.playSpeed);
         }
         updateUI(); // Oppdater knappetekst etc. umiddelbart
     }

    function resetGame() {
        if (gameState.gameInterval) clearInterval(gameState.gameInterval);
         if (gameState.isTournamentRunning) return; // Ikke nullstill under turnering

        gameState = createInitialGameState(); // Hent en frisk tilstand

        // Les verdier fra UI inn i den nye tilstanden
        gameState.p1.type = p1TypeSelect.value;
        gameState.p2.type = p2TypeSelect.value;
        gameState.p1.strategyKey = p1StrategySelect.value;
        gameState.p2.strategyKey = p2StrategySelect.value;
        gameState.totalRounds = parseInt(roundsInput.value) || 200;
        gameState.noiseLevel = parseInt(noiseInput.value) || 0;
        gameState.playSpeed = parseInt(playSpeedSlider.value) || 200;
        speedValueSpan.textContent = gameState.playSpeed; // Oppdater speed display

        // Nullstill strategitilstand
        Object.values(allStrategies).forEach(strat => {
            if (strat.reset) strat.reset();
        });

        gameState.isGameOver = false; // Gjør klar til å spille
        historyList.innerHTML = ''; // Tøm historikkvisning
        tournamentResultsTableBody.innerHTML = ''; // Tøm turneringsresultater

        updateUI(); // Oppdater hele UI
    }

    function addRuleBasedAgent() {
        const name = customAgentNameInput.value.trim();
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now(); // Legg til timestamp for unikhet

        if (!name) { alert("Vennligst gi agenten et navn."); return; }
        if (allStrategies[key] || Object.values(allStrategies).some(s => s.name === name)) {
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

        const agentFn = createRuleBasedAgentFn(rules);

         allStrategies[key] = { name, isCustom: true, isRuleBased: true, fn: agentFn, rules };

        populateStrategyDropdowns();
        populateTournamentAgentList();
        customAgentNameInput.value = ''; // Nullstill
        alert(`Agenten "${name}" ble lagt til!`);
    }

    // === Turneringslogikk ===
     async function runTournament() {
         if (gameState.isTournamentRunning || !gameState.isGameOver) {
              alert("Fullfør eller nullstill pågående spill/turnering først.");
              return;
         }

         const selectedAgentKeys = Array.from($$('#tournament-agent-list input:checked')).map(cb => cb.value);

         if (selectedAgentKeys.length < 2) {
             alert("Velg minst to agenter."); return;
         }

         // Les globale innstillinger FØR turneringen starter
         const roundsPerGame = parseInt(roundsInput.value) || 200;
         const noisePercent = parseInt(noiseInput.value) || 0;

         gameState.isTournamentRunning = true;
         gameState.isGameOver = false; // Turnering pågår
         startTournamentBtn.disabled = true;
         startTournamentBtn.textContent = "Kjører...";
         tournamentResultsContainer.classList.add('hidden');
         tournamentStatusDiv.classList.remove('hidden');
         updateUI(); // Oppdater diverse UI-elementer

         const tournamentScores = {};
         selectedAgentKeys.forEach(key => { tournamentScores[key] = 0; });

         const totalGamesToPlay = selectedAgentKeys.length * selectedAgentKeys.length;
         let gamesPlayed = 0;

         // Kjør alle spillpar
         for (let i = 0; i < selectedAgentKeys.length; i++) {
             for (let j = 0; j < selectedAgentKeys.length; j++) {
                 gamesPlayed++;
                 const key1 = selectedAgentKeys[i];
                 const key2 = selectedAgentKeys[j];
                 tournamentStatusDiv.textContent = `Spill ${gamesPlayed}/${totalGamesToPlay}: ${allStrategies[key1].name} vs ${allStrategies[key2].name}`;

                 // Nullstill stateful strategier
                 if (allStrategies[key1]?.reset) allStrategies[key1].reset();
                 if (allStrategies[key2]?.reset) allStrategies[key2].reset();

                 let p1ScoreThisGame = 0;
                 let p2ScoreThisGame = 0;
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
                       // Poengsum for P2 legges kun til hvis det ikke er spill mot seg selv
                      if (i !== j) {
                           p2ScoreThisGame += payoff.p2;
                      }

                      historyThisGame.push({
                          round: r + 1,
                          p1Choice: resultP1.choice, p1Intended: resultP1.intended, p1Errored: resultP1.errored,
                          p2Choice: resultP2.choice, p2Intended: resultP2.intended, p2Errored: resultP2.errored,
                          p1Score: payoff.p1, p2Score: payoff.p2
                      });
                 }

                 tournamentScores[key1] += p1ScoreThisGame;
                 if (i !== j) {
                     tournamentScores[key2] += p2ScoreThisGame;
                 } else {
                      // Når agent spiller mot seg selv, legges poengsummen til én gang
                      // for å beregne gjennomsnitt korrekt over alle spill.
                      // (Alternativt kunne man delt selv-spill-poeng på 2, men
                      // å dele totalen på (antall agenter * runder) gir samme snitt)
                 }


                 await new Promise(resolve => setTimeout(resolve, 0)); // UI-oppdateringspause
             }
         }

         displayTournamentResults(tournamentScores, selectedAgentKeys.length, roundsPerGame);

         gameState.isTournamentRunning = false;
         gameState.isGameOver = true;
         startTournamentBtn.disabled = false;
         startTournamentBtn.textContent = "Kjør Turnering";
         tournamentStatusDiv.classList.add('hidden');
         updateUI(); // Viser resultater og konfig igjen
     }

    // --- Event Listeners ---
    resetGameBtn.addEventListener('click', resetGame);

    p1TypeSelect.addEventListener('change', resetGame); // Enklest å nullstille ved typeendring
    p2TypeSelect.addEventListener('change', resetGame);
    p1StrategySelect.addEventListener('change', () => { gameState.p1.strategyKey = p1StrategySelect.value; updateUI(); }); // Bare oppdater state, ikke nullstill
    p2StrategySelect.addEventListener('change', () => { gameState.p2.strategyKey = p2StrategySelect.value; updateUI(); });
    roundsInput.addEventListener('change', () => { gameState.totalRounds = parseInt(roundsInput.value) || 200; updateUI(); });
    noiseInput.addEventListener('change', () => { gameState.noiseLevel = parseInt(noiseInput.value) || 0; updateUI(); });

    p1ChoiceBtns.forEach(button => button.addEventListener('click', (e) => {
        if (!gameState.isGameOver && gameState.p1.type === 'human' && !gameState.humanPlayer1ChoiceMade) {
            gameState.p1.choice = e.target.dataset.choice;
            gameState.humanPlayer1ChoiceMade = true;
            p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            updateUI();
        }
    }));
    p2ChoiceBtns.forEach(button => button.addEventListener('click', (e) => {
        if (!gameState.isGameOver && gameState.p2.type === 'human' && !gameState.humanPlayer2ChoiceMade) {
            gameState.p2.choice = e.target.dataset.choice;
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
        if (gameState.isAutoPlaying) { // Juster farten hvis den kjører
            clearInterval(gameState.gameInterval);
            togglePlayAll(); // Starter den på nytt med ny fart (og oppdaterer knapp)
        }
    });

    addRuleAgentBtn.addEventListener('click', addRuleBasedAgent);
    startTournamentBtn.addEventListener('click', runTournament);


    // --- Initialisering ved Lasting ---
    populateStrategyDropdowns();
    populateTournamentAgentList();
    updateUI(); // Vis den initielle (konfigurasjons-) tilstanden

});
