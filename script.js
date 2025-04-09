document.addEventListener('DOMContentLoaded', () => {
    // --- Globale variabler og tilstand ---
    let gameState = {
        p1: { id: 1, score: 0, type: 'ai', strategyKey: 'titForTat', choice: null, intendedChoice: null, errored: false },
        p2: { id: 2, score: 0, type: 'ai', strategyKey: 'alwaysDefect', choice: null, intendedChoice: null, errored: false },
        history: [], // { round: #, p1Choice: 'C'/'D', p1Intended: 'C'/'D', p1Errored: bool, p2Choice: 'C'/'D', p2Intended: 'C'/'D', p2Errored: bool, p1Score: #, p2Score: # }
        currentRound: 0,
        totalRounds: 200,
        noiseLevel: 0, // Prosent
        payoffs: {
            'C': { 'C': { p1: 3, p2: 3 }, 'D': { p1: 0, p2: 5 } },
            'D': { 'C': { p1: 5, p2: 0 }, 'D': { p1: 1, p2: 1 } }
        },
        gameInterval: null,
        playSpeed: 200,
        humanPlayer1ChoiceMade: false,
        humanPlayer2ChoiceMade: false,
        isGameOver: true,
        isAutoPlaying: false,
        isTournamentRunning: false
    };

    // --- AI Strategier ---
    // Nøkkel: unik id, Verdi: { name: Visningsnavn, isCustom: bool, isRuleBased: bool, fn: funksjon, rules: (for regelbasert), state: (for stateful), reset: (for stateful) }
    let allStrategies = {
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
                // Kopier motstanderens trekk, MEN ha 10% sjanse for å svike hvis motstanderen samarbeidet
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
                // Lik TFT, men 10% sjanse for å tilgi (samarbeide) selv etter svik
                return (opponentLastMove === 'D' && Math.random() < 0.1) ? 'C' : opponentLastMove;
            }
        },
        tester: {
            name: "Tester", isCustom: false, isRuleBased: false, state: { opponentRetaliated: false, tested: false },
            fn: function(myH, oppH) {
                if (myH.length === 0) { // Første trekk
                    this.state.tested = true;
                    return 'D';
                }
                if (myH.length === 1 && this.state.tested) { // Andre trekk, sjekk respons
                    if (oppH[0].choice === 'D') {
                        this.state.opponentRetaliated = true;
                    }
                    // Samarbeid i andre runde uansett (unnskyldning)
                    return 'C';
                }
                 // Etter testfasen
                 if (this.state.opponentRetaliated) {
                     // Oppfør deg som TFT hvis de straffet
                     return oppH.length > 0 ? oppH[oppH.length - 1].choice : 'C';
                 } else {
                     // Utnytt hvis de ikke straffet (Always Defect etter test)
                     return 'D';
                 }
             },
             reset: function() { this.state.opponentRetaliated = false; this.state.tested = false; }
        }
    };

    // --- DOM Element Referanser ---
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

    // --- Hjelpefunksjoner ---

    function getSelectedRadioValue(radioGroupName) {
        const selected = document.querySelector(`input[name="${radioGroupName}"]:checked`);
        return selected ? selected.value : null;
    }

    function createRuleBasedAgentFn(rules) {
        // Returnerer en *ny* funksjon basert på de gitte reglene
        return function(myHistory, oppHistory) {
            if (oppHistory.length === 0) {
                return rules.firstMove; // Bruk den lagrede regelen for første trekk
            }
            const opponentLastChoice = oppHistory[oppHistory.length - 1].choice;
            if (opponentLastChoice === 'C') {
                return rules.afterOpponentC; // Bruk lagret regel
            } else { // Opponent defected
                return rules.afterOpponentD; // Bruk lagret regel
            }
        };
    }

    function populateStrategyDropdowns() {
        const selects = [p1StrategySelect, p2StrategySelect];
         // Sorter etter navn før populering
        const sortedKeys = Object.keys(allStrategies).sort((a, b) => allStrategies[a].name.localeCompare(allStrategies[b].name));

        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '';
             sortedKeys.forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
                select.appendChild(option);
            });
            if (allStrategies[currentValue]) {
                select.value = currentValue;
            } else {
                 // Prøv å sette standardvalg hvis mulig
                if (select.id === 'p1-strategy' && allStrategies['titForTat']) select.value = 'titForTat';
                 else if (select.id === 'p2-strategy' && allStrategies['alwaysDefect']) select.value = 'alwaysDefect';
                 else if (select.options.length > 0) select.selectedIndex = 0; // Fallback til første
            }
        });
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
             checkbox.checked = !allStrategies[key].isCustom; // Velg alle predefinerte som standard
             const label = document.createElement('label');
             label.htmlFor = `ts-${key}`;
             label.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
             div.appendChild(checkbox);
             div.appendChild(label);
             tournamentAgentListDiv.appendChild(div);
         });
     }

     function updateUI() {
         const isP1Human = gameState.p1.type === 'human';
         const isP2Human = gameState.p2.type === 'human';

         // Skjul/vis AI-spesifikke ting
         p1AiOptions.style.display = isP1Human ? 'none' : 'flex';
         p2AiOptions.style.display = isP2Human ? 'none' : 'flex';
         p1HumanControls.classList.toggle('hidden', !isP1Human || gameState.isGameOver);
         p2HumanControls.classList.toggle('hidden', !isP2Human || gameState.isGameOver);

         // Oppdater panel-IDer og strateginavn
         p1IdSpan.textContent = isP1Human ? 'Menneske' : 'AI';
         p2IdSpan.textContent = isP2Human ? 'Menneske' : 'AI';
         p1StrategyNameP.textContent = !isP1Human && gameState.p1.strategyKey ? allStrategies[gameState.p1.strategyKey].name : '';
         p2StrategyNameP.textContent = !isP2Human && gameState.p2.strategyKey ? allStrategies[gameState.p2.strategyKey].name : '';
         p1StrategyNameP.classList.toggle('hidden', isP1Human);
         p2StrategyNameP.classList.toggle('hidden', isP2Human);


         // Oppdater spillstatus og poeng
         roundCounterSpan.textContent = gameState.currentRound;
         totalRoundsDisplaySpan.textContent = gameState.totalRounds;
         noiseDisplaySpan.textContent = gameState.noiseLevel;
         p1ScoreSpan.textContent = gameState.p1.score;
         p2ScoreSpan.textContent = gameState.p2.score;
         p1AvgScoreSpan.textContent = (gameState.currentRound > 0 ? (gameState.p1.score / gameState.currentRound) : 0).toFixed(2);
         p2AvgScoreSpan.textContent = (gameState.currentRound > 0 ? (gameState.p2.score / gameState.currentRound) : 0).toFixed(2);

         // Nullstill visning av siste valg hvis spillet ikke er i gang eller nettopp nullstilt
         if (gameState.currentRound === 0 || gameState.history.length < gameState.currentRound) {
             p1ChosenSpan.textContent = '?'; p1ChosenSpan.className = 'chosen';
             p2ChosenSpan.textContent = '?'; p2ChosenSpan.className = 'chosen';
         } else if (gameState.history.length > 0){ // Vis siste valg
             const lastRound = gameState.history[gameState.history.length - 1];
             p1ChosenSpan.textContent = lastRound.p1Choice;
             p1ChosenSpan.className = `chosen ${lastRound.p1Choice === 'C' ? 'cooperate' : 'defect'} ${lastRound.p1Errored ? 'error' : ''}`;
             if(lastRound.p1Errored) p1ChosenSpan.title = `Intensjon var ${lastRound.p1Intended}`; else p1ChosenSpan.title = '';

             p2ChosenSpan.textContent = lastRound.p2Choice;
             p2ChosenSpan.className = `chosen ${lastRound.p2Choice === 'C' ? 'cooperate' : 'defect'} ${lastRound.p2Errored ? 'error' : ''}`;
              if(lastRound.p2Errored) p2ChosenSpan.title = `Intensjon var ${lastRound.p2Intended}`; else p2ChosenSpan.title = '';
         }

         // Aktiver/deaktiver spillkontrollknapper
         const canPlayStep = !gameState.isGameOver &&
                             (isP1Human ? gameState.humanPlayer1ChoiceMade : true) &&
                             (isP2Human ? gameState.humanPlayer2ChoiceMade : true);
         playStepBtn.disabled = !canPlayStep || gameState.isAutoPlaying || gameState.isTournamentRunning;
         play10Btn.disabled = isP1Human || isP2Human || gameState.isGameOver || gameState.isAutoPlaying || gameState.isTournamentRunning;
         play100Btn.disabled = isP1Human || isP2Human || gameState.isGameOver || gameState.isAutoPlaying || gameState.isTournamentRunning;
         playAllBtn.disabled = isP1Human || isP2Human || gameState.isGameOver || gameState.isTournamentRunning;
         playAllBtn.textContent = gameState.isAutoPlaying ? "Stopp" : "Kjør Resten";


         // Vis/skjul spillseksjon og game over-melding
         gameSection.classList.toggle('hidden', gameState.isGameOver && !gameState.isTournamentRunning); // Vis under turnering også? Nei.
         gameOverMessage.classList.toggle('hidden', !gameState.isGameOver || gameState.currentRound === 0 || gameState.isTournamentRunning);

          // Vis/Skjul turneringsresultater/status
         tournamentStatusDiv.classList.toggle('hidden', !gameState.isTournamentRunning);
         tournamentResultsContainer.classList.toggle('hidden', gameState.isTournamentRunning || tournamentResultsTableBody.innerHTML === ''); // Skjul hvis tom

         // Nullstill valgt-klasse på menneskeknapper hvis deres valg er null
         if (!gameState.humanPlayer1ChoiceMade) p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
         if (!gameState.humanPlayer2ChoiceMade) p2ChoiceBtns.forEach(b => b.classList.remove('selected'));
     }

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
                 <span class="history-p1">P1: <span class="${p1ChoiceClass}">${roundData.p1Choice}</span>${p1Err} (+${roundData.p1Score})</span>
                 <span class="history-p2">P2: <span class="${p2ChoiceClass}">${roundData.p2Choice}</span>${p2Err} (+${roundData.p2Score})</span>
             `;
             historyList.appendChild(li);
         }
         historyList.scrollTop = historyList.scrollHeight; // Scroll til bunnen
     }

     function getAgentChoice(agentState, opponentState, history) {
         if (agentState.type === 'human') {
             return agentState.choice; // Må være satt fra knappetrykk
         }
         const strategy = allStrategies[agentState.strategyKey];
         if (!strategy || !strategy.fn) {
             console.error("Ugyldig eller manglende strategi:", agentState.strategyKey);
             return 'C'; // Sikker fallback
         }
         try {
             // Lag historikk spesifikt for denne agenten
             const myHistory = history.map(h => agentState.id === 1 ?
                 { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored } :
                 { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored }
             );
             const oppHistory = history.map(h => agentState.id === 1 ?
                 { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored } :
                 { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored }
             );

             // Kjør funksjonen, bruk .call for stateful strategier hvis 'state' finnes
             let choice;
              if (strategy.state) {
                  choice = strategy.fn.call(strategy, myHistory, oppHistory);
              } else {
                  choice = strategy.fn(myHistory, oppHistory);
              }

             // Valider output
             if (choice !== 'C' && choice !== 'D') {
                 console.warn(`Strategi ${agentState.strategyKey} returnerte ugyldig verdi: ${choice}. Bruker 'C'.`);
                 return 'C';
             }
             return choice;
         } catch (e) {
             console.error(`Feil under kjøring av strategi ${agentState.strategyKey}:`, e);
             return 'C'; // Sikker fallback
         }
     }

     function applyNoise(intendedChoice, noisePercent) {
         const didError = Math.random() * 100 < noisePercent;
         const actualChoice = didError ? (intendedChoice === 'C' ? 'D' : 'C') : intendedChoice;
         return { choice: actualChoice, errored: didError, intended: intendedChoice };
     }

    function playSingleStep() {
        if (gameState.isGameOver || gameState.isTournamentRunning) return;

         const p1Intended = getAgentChoice(gameState.p1, gameState.p2, gameState.history);
         const p2Intended = getAgentChoice(gameState.p2, gameState.p1, gameState.history);

         if ((gameState.p1.type === 'human' && !p1Intended) || (gameState.p2.type === 'human' && !p2Intended)) {
             console.warn("Mangler menneskelig valg for å spille runde.");
             return; // Ikke spill runden
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

         // Nullstill menneskelige valg for neste runde
         gameState.p1.choice = null;
         gameState.p2.choice = null;
         gameState.humanPlayer1ChoiceMade = false;
         gameState.humanPlayer2ChoiceMade = false;

         if (gameState.currentRound >= gameState.totalRounds) {
             gameState.isGameOver = true;
             gameState.isAutoPlaying = false; // Stopp auto-spill
             if(gameState.gameInterval) clearInterval(gameState.gameInterval);
             gameState.gameInterval = null;
         }

         updateUI();
         updateHistoryList(); // Oppdater loggen
     }

     function playMultipleSteps(steps) {
         if (gameState.p1.type === 'human' || gameState.p2.type === 'human') {
             alert("Kan ikke spille flere trekk automatisk med menneskelige spillere.");
             return;
         }
         const targetRound = Math.min(gameState.totalRounds, gameState.currentRound + steps);
         while (gameState.currentRound < targetRound && !gameState.isGameOver) {
             playSingleStep();
         }
         updateUI(); // Sørg for at UI er oppdatert etterpå
         updateHistoryList();
     }

     function togglePlayAll() {
          if (gameState.p1.type === 'human' || gameState.p2.type === 'human') {
              alert("Kan ikke kjøre automatisk med menneskelige spillere.");
              return;
          }

         if (gameState.isAutoPlaying) {
             // Stopp
             clearInterval(gameState.gameInterval);
             gameState.gameInterval = null;
             gameState.isAutoPlaying = false;
         } else {
             // Start
             gameState.isAutoPlaying = true;
             gameState.gameInterval = setInterval(() => {
                 if (!gameState.isGameOver) {
                     playSingleStep();
                 } else {
                     clearInterval(gameState.gameInterval);
                     gameState.gameInterval = null;
                     gameState.isAutoPlaying = false;
                     updateUI(); // Oppdater knapper
                 }
             }, gameState.playSpeed);
         }
         updateUI(); // Oppdater knappetekst etc.
     }

     function resetGame() {
         if (gameState.gameInterval) clearInterval(gameState.gameInterval);
         gameState.gameInterval = null;
         gameState.isAutoPlaying = false;
         gameState.isTournamentRunning = false; // Viktig

         // Les innstillinger
         gameState.p1.type = p1TypeSelect.value;
         gameState.p2.type = p2TypeSelect.value;
         gameState.p1.strategyKey = p1StrategySelect.value;
         gameState.p2.strategyKey = p2StrategySelect.value;
         gameState.totalRounds = parseInt(roundsInput.value) || 200;
         gameState.noiseLevel = parseInt(noiseInput.value) || 0;
         gameState.playSpeed = parseInt(playSpeedSlider.value) || 200;

         // Nullstill tilstand
         gameState.p1.score = 0;
         gameState.p2.score = 0;
         gameState.p1.choice = null;
         gameState.p2.choice = null;
         gameState.history = [];
         gameState.currentRound = 0;
         gameState.isGameOver = false;
         gameState.humanPlayer1ChoiceMade = false;
         gameState.humanPlayer2ChoiceMade = false;

         // Nullstill stateful strategier
         Object.values(allStrategies).forEach(strat => {
             if (strat.reset) strat.reset();
         });

         historyList.innerHTML = ''; // Tøm historikkvisning
         gameOverMessage.classList.add('hidden');
         tournamentResultsContainer.classList.add('hidden'); // Skjul turneringsres.
         tournamentStatusDiv.classList.add('hidden');

         updateUI(); // Oppdater hele UIet
     }

    function addRuleBasedAgent() {
        const name = customAgentNameInput.value.trim();
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, ''); // Enkel nøkkelgenerering

        if (!name || !key) {
            alert("Vennligst gi agenten et navn.");
            return;
        }
         if (allStrategies[key]) {
            alert(`En agent med navnet "${name}" (eller lignende nøkkel '${key}') finnes allerede.`);
            return;
        }

        const rules = {
            firstMove: getSelectedRadioValue('rule-first'),
            afterOpponentC: getSelectedRadioValue('rule-opp-c'),
            afterOpponentD: getSelectedRadioValue('rule-opp-d')
        };

        if (!rules.firstMove || !rules.afterOpponentC || !rules.afterOpponentD) {
            alert("Vennligst velg regler for alle situasjoner.");
            return;
        }

         // Lag funksjonen basert på reglene
        const agentFn = createRuleBasedAgentFn(rules);

         allStrategies[key] = {
             name: name,
             isCustom: true,
             isRuleBased: true,
             fn: agentFn,
             rules: rules // Lagre reglene for evt. visning/redigering senere
         };

        console.log(`Regelbasert agent "${name}" lagt til med nøkkel "${key}".`);
        populateStrategyDropdowns();
        populateTournamentAgentList();
        customAgentNameInput.value = ''; // Nullstill input
        alert(`Agenten "${name}" ble lagt til!`);
    }

    // --- Turneringslogikk (tilpasset fra forrige) ---
     async function runTournament() {
         if (gameState.isTournamentRunning) return;

         const selectedAgentKeys = [];
         $$('#tournament-agent-list input[type="checkbox"]:checked').forEach(cb => {
             selectedAgentKeys.push(cb.value);
         });

         if (selectedAgentKeys.length < 2) {
             alert("Velg minst to agenter for turneringen.");
             return;
         }

         gameState.isTournamentRunning = true;
         startTournamentBtn.disabled = true;
         startTournamentBtn.textContent = "Kjører...";
         tournamentResultsContainer.classList.add('hidden');
         tournamentStatusDiv.classList.remove('hidden');
         updateUI(); // Deaktiver spillkontroller etc.

         const roundsPerGame = parseInt(roundsInput.value) || 200;
         const noisePercent = parseInt(noiseInput.value) || 0;
         const tournamentScores = {}; // { strategyKey: totalScore }
         selectedAgentKeys.forEach(key => { tournamentScores[key] = 0; });

         const totalGamesToPlay = selectedAgentKeys.length * selectedAgentKeys.length;
         let gamesPlayed = 0;

         for (let i = 0; i < selectedAgentKeys.length; i++) {
             for (let j = 0; j < selectedAgentKeys.length; j++) {
                 gamesPlayed++;
                 const key1 = selectedAgentKeys[i];
                 const key2 = selectedAgentKeys[j];
                 tournamentStatusDiv.textContent = `Spill ${gamesPlayed}/${totalGamesToPlay}: ${allStrategies[key1].name} vs ${allStrategies[key2].name}`;

                 // Nullstill stateful strategier før *hvert* spill
                 if (allStrategies[key1]?.reset) allStrategies[key1].reset();
                 if (allStrategies[key2]?.reset) allStrategies[key2].reset();


                 let currentGameScoreP1 = 0;
                 let currentGameScoreP2 = 0;
                 let currentHistory = [];

                 for (let r = 0; r < roundsPerGame; r++) {
                     const agent1State = { id: 1, type: 'ai', strategyKey: key1 }; // Midlertidig
                     const agent2State = { id: 2, type: 'ai', strategyKey: key2 }; // Midlertidig

                      const intendedP1 = getAgentChoice(agent1State, agent2State, currentHistory);
                      const intendedP2 = getAgentChoice(agent2State, agent1State, currentHistory);

                      const resultP1 = applyNoise(intendedP1, noisePercent);
                      const resultP2 = applyNoise(intendedP2, noisePercent);

                      const payoff = gameState.payoffs[resultP1.choice][resultP2.choice];
                      currentGameScoreP1 += payoff.p1;
                      currentGameScoreP2 += payoff.p2;

                      currentHistory.push({
                          round: r + 1,
                          p1Choice: resultP1.choice, p1Intended: resultP1.intended, p1Errored: resultP1.errored,
                          p2Choice: resultP2.choice, p2Intended: resultP2.intended, p2Errored: resultP2.errored,
                          p1Score: payoff.p1, p2Score: payoff.p2
                      });
                 }

                 tournamentScores[key1] += currentGameScoreP1;
                  // Når en agent spiller mot seg selv, legges poengene til én gang.
                  // Når de spiller mot andre, legges begge poengsummene til den respektive agenten.
                 if (i !== j) {
                    tournamentScores[key2] += currentGameScoreP2;
                 }

                 // Liten pause for å la UI oppdatere progress-teksten
                 await new Promise(resolve => setTimeout(resolve, 0));
             }
         }

         displayTournamentResults(tournamentScores, selectedAgentKeys.length, roundsPerGame);

         gameState.isTournamentRunning = false;
         gameState.isGameOver = true; // Sett spillstatus til over
         startTournamentBtn.disabled = false;
         startTournamentBtn.textContent = "Kjør Turnering";
         tournamentStatusDiv.classList.add('hidden');
         tournamentResultsContainer.classList.remove('hidden');
         updateUI();
     }

      function displayTournamentResults(scores, numStrategies, roundsPerGame) {
          const results = [];
          for (const key in scores) {
                // Korrekt gjennomsnitt: total poengsum / (antall spill * runder per spill)
                // Antall spill er numStrategies (siden den spiller mot alle, inkludert seg selv)
               const averageScore = scores[key] / (numStrategies * roundsPerGame);
               results.push({ key: key, name: allStrategies[key].name, average: averageScore });
           }

          results.sort((a, b) => b.average - a.average); // Sorter synkende

          tournamentResultsTableBody.innerHTML = '';
          results.forEach((result, index) => {
              const row = tournamentResultsTableBody.insertRow();
              row.innerHTML = `
                  <td>${index + 1}</td>
                  <td>${result.name}${allStrategies[result.key].isCustom ? ' (Egen)' : ''}</td>
                  <td>${result.average.toFixed(2)}</td>
              `;
          });
           tournamentResultsContainer.classList.remove('hidden'); // Sørg for at den vises
      }

    // --- Event Listeners ---
    resetGameBtn.addEventListener('click', resetGame);

    p1TypeSelect.addEventListener('change', () => { gameState.p1.type = p1TypeSelect.value; resetGame(); });
    p2TypeSelect.addEventListener('change', () => { gameState.p2.type = p2TypeSelect.value; resetGame(); });
    p1StrategySelect.addEventListener('change', () => { gameState.p1.strategyKey = p1StrategySelect.value; resetGame();});
    p2StrategySelect.addEventListener('change', () => { gameState.p2.strategyKey = p2StrategySelect.value; resetGame();});
    roundsInput.addEventListener('change', () => { gameState.totalRounds = parseInt(roundsInput.value) || 200; updateUI(); });
     noiseInput.addEventListener('change', () => { gameState.noiseLevel = parseInt(noiseInput.value) || 0; updateUI(); });


    p1ChoiceBtns.forEach(button => button.addEventListener('click', (e) => {
        if (!gameState.isGameOver && gameState.p1.type === 'human') {
            gameState.p1.choice = e.target.dataset.choice;
            gameState.humanPlayer1ChoiceMade = true;
            p1ChoiceBtns.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            updateUI();
        }
    }));
     p2ChoiceBtns.forEach(button => button.addEventListener('click', (e) => {
        if (!gameState.isGameOver && gameState.p2.type === 'human') {
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
        const newSpeed = parseInt(e.target.value);
        gameState.playSpeed = newSpeed;
        speedValueSpan.textContent = newSpeed;
        if (gameState.isAutoPlaying) { // Oppdater intervallet hvis det kjører
            clearInterval(gameState.gameInterval);
            togglePlayAll(); // Start det på nytt med ny hastighet
            togglePlayAll(); // Stopp det igjen for å oppdatere knappetekst
        }
    });

    addRuleAgentBtn.addEventListener('click', addRuleBasedAgent);
    startTournamentBtn.addEventListener('click', runTournament);

    // Koble begge "Nye Innstillinger"-knappene til resetGame
    $('#show-settings-btn-game')?.addEventListener('click', resetGame);
    $('#show-settings-btn-tournament')?.addEventListener('click', resetGame);


    // --- Initialisering ---
    populateStrategyDropdowns();
    populateTournamentAgentList();
    resetGame(); // Setter opp standardverdier og initielt UI
    updateUI();

});
