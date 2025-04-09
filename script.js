document.addEventListener('DOMContentLoaded', () => {
    // --- Globale variabler og tilstand ---
    let gameState = {
        player1: { id: 1, score: 0, type: 'human', strategyKey: null, choice: null, intendedChoice: null, errored: false },
        player2: { id: 2, score: 0, type: 'ai', strategyKey: 'titForTat', choice: null, intendedChoice: null, errored: false },
        history: [],
        currentRound: 0,
        totalRounds: 10,
        noiseLevel: 0,
        payoffs: {
            'C': { 'C': { p1: 3, p2: 3 }, 'D': { p1: 0, p2: 5 } },
            'D': { 'C': { p1: 5, p2: 0 }, 'D': { p1: 1, p2: 1 } }
        },
        gameInterval: null,
        playSpeed: 500,
        humanPlayer1ChoiceMade: false,
        humanPlayer2ChoiceMade: false,
        isGameOver: true, // Start som game over
        isTournamentRunning: false
    };

    // --- AI Strategier (Objekt som holder både predefinerte og egendefinerte) ---
    let allStrategies = {
        // Predefinerte
        alwaysCooperate: { name: "Alltid Samarbeid", isCustom: false, fn: (pHistory, oHistory) => 'C' },
        alwaysDefect: { name: "Alltid Svik", isCustom: false, fn: (pHistory, oHistory) => 'D' },
        randomChoice: { name: "Tilfeldig", isCustom: false, fn: (pHistory, oHistory) => Math.random() < 0.5 ? 'C' : 'D' },
        titForTat: {
            name: "Tit For Tat (TFT)", isCustom: false,
            fn: (pHistory, oHistory) => oHistory.length === 0 ? 'C' : oHistory[oHistory.length - 1].choice
        },
        grimTrigger: {
            name: "Grim Trigger", isCustom: false, state: { hasDefected: false },
            fn: function(pHistory, oHistory) {
                if (this.state.hasDefected) return 'D';
                if (oHistory.length > 0 && oHistory[oHistory.length - 1].choice === 'D') {
                    this.state.hasDefected = true;
                    return 'D';
                }
                return 'C';
            },
            reset: function() { this.state.hasDefected = false; } // Reset function
        },
        joss: {
           name: "Joss (Sleip TFT)", isCustom: false,
            fn: (pHistory, oHistory) => {
                if (oHistory.length === 0) return 'C';
                const opponentLastMove = oHistory[oHistory.length - 1].choice;
                return (opponentLastMove === 'C' && Math.random() < 0.1) ? 'D' : opponentLastMove;
            }
        },
        titForTwoTats: {
            name: "Tit For Two Tats (TFT2T)", isCustom: false,
            fn: (pHistory, oHistory) => {
                if (oHistory.length < 2) return 'C';
                return (oHistory[oHistory.length - 1].choice === 'D' && oHistory[oHistory.length - 2].choice === 'D') ? 'D' : 'C';
            }
        },
       generousTitForTat: {
           name: "Generous Tit For Tat (GTFT)", isCustom: false,
           fn: (pHistory, oHistory) => {
               if (oHistory.length === 0) return 'C';
               const opponentLastMove = oHistory[oHistory.length - 1].choice;
               return (opponentLastMove === 'D' && Math.random() < 0.1) ? 'C' : opponentLastMove;
           }
       }
        // Egendefinerte legges til her dynamisk
    };

    // --- DOM Element Referanser ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const player1TypeSelect = $('#player1-type');
    const player2TypeSelect = $('#player2-type');
    const player1StrategySelect = $('#player1-strategy');
    const player2StrategySelect = $('#player2-strategy');
    const player1StrategyContainer = $('.ai-setting.player1');
    const player2StrategyContainer = $('.ai-setting.player2');
    const numRoundsInput = $('#num-rounds');
    const noiseLevelInput = $('#noise-level');
    const startGameBtn = $('#start-game-btn');
    const gameContainer = $('.game-container');
    const settingsContainer = $('.settings-container'); // The main one
    const customStrategyContainer = $('.custom-strategy-container');
    const tournamentContainer = $('.tournament-container');
    const currentRoundSpan = $('#current-round');
    const totalRoundsSpan = $('#total-rounds');
    const player1Panel = $('#player1-panel');
    const player2Panel = $('#player2-panel');
    const playRoundBtn = $('#play-round-btn');
    const playAllRoundsBtn = $('#play-all-rounds-btn');
    const playSpeedSlider = $('#play-speed');
    const speedValueSpan = $('#speed-value');
    const historyTableBody = $('#history-table tbody');
    const historyContainer = $('.history-container'); // For scrolling
    const resultsSummaryDiv = $('.results-summary');
    const finalOutcomeP = $('#final-outcome');
    const showSettingsBtn = $('#show-settings-btn');
    const customStrategyNameInput = $('#custom-strategy-name');
    const customStrategyCodeTextarea = $('#custom-strategy-code');
    const addCustomStrategyBtn = $('#add-custom-strategy-btn');
    const tournamentStrategyListDiv = $('#tournament-strategy-list');
    const startTournamentBtn = $('#start-tournament-btn');
    const tournamentProgressDiv = $('#tournament-progress');
    const tournamentResultsContainer = $('#tournament-results-container');
    const tournamentResultsTableBody = $('#tournament-results-table tbody');

    // --- Hjelpefunksjoner ---

    function populateStrategyDropdowns() {
        const selects = [player1StrategySelect, player2StrategySelect];
        selects.forEach(select => {
            const currentValue = select.value; // Husk valgt verdi
            select.innerHTML = '';
            Object.keys(allStrategies).sort((a, b) => allStrategies[a].name.localeCompare(allStrategies[b].name)).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
                select.appendChild(option);
            });
            // Prøv å sette tilbake valgt verdi
             if (allStrategies[currentValue]) {
                 select.value = currentValue;
             } else if (select.options.length > 0) {
                select.value = 'titForTat'; // Fallback til TFT hvis forrige valg forsvant
             }
        });
    }

    function populateTournamentStrategyList() {
        tournamentStrategyListDiv.innerHTML = '';
         Object.keys(allStrategies).sort((a, b) => allStrategies[a].name.localeCompare(allStrategies[b].name)).forEach(key => {
            const div = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `ts-${key}`;
            checkbox.value = key;
            checkbox.checked = true; // Default to selected
            const label = document.createElement('label');
            label.htmlFor = `ts-${key}`;
            label.textContent = allStrategies[key].name + (allStrategies[key].isCustom ? ' (Egen)' : '');
            div.appendChild(checkbox);
            div.appendChild(label);
            tournamentStrategyListDiv.appendChild(div);
        });
    }

    function updateUI() {
        // Oppdater rundeteller
        currentRoundSpan.textContent = gameState.currentRound;
        totalRoundsSpan.textContent = gameState.totalRounds;

        // Generell funksjon for å oppdatere et spillerpanel
        const updatePlayerPanel = (panel, playerState) => {
            panel.querySelector('.player-type').textContent = playerState.type === 'human' ? 'Menneske' : 'AI';
            panel.querySelector('.total-score').textContent = playerState.score;
            const strategyDisplay = panel.querySelector('.strategy-display');
            const humanControls = panel.querySelector('.human-controls');
            const choiceDisplay = panel.querySelector('.choice-display');
            const roundScoreDisplay = panel.querySelector('.round-score');

            if (playerState.type === 'ai') {
                 strategyDisplay.textContent = playerState.strategyKey ? `Strategi: ${allStrategies[playerState.strategyKey]?.name ?? 'Ukjent'}` : '';
                 strategyDisplay.classList.remove('hidden');
                 humanControls.classList.add('hidden');
                 (playerState.id === 1 ? player1StrategyContainer : player2StrategyContainer).style.display = 'flex';
            } else {
                 strategyDisplay.classList.add('hidden');
                 humanControls.classList.remove('hidden');
                 (playerState.id === 1 ? player1StrategyContainer : player2StrategyContainer).style.display = 'none';
                 // Sørg for at knappene ikke er 'selected' når en ny runde starter
                  if (!playerState.choice) {
                     panel.querySelectorAll('.choice-btn').forEach(btn => btn.classList.remove('selected'));
                  }
            }

             // Vis siste rundes valg/poeng eller '?'
             if (gameState.history.length > 0 && gameState.history.length === gameState.currentRound) {
                 const lastRound = gameState.history[gameState.currentRound - 1];
                 const choice = playerState.id === 1 ? lastRound.p1Choice : lastRound.p2Choice;
                 const errored = playerState.id === 1 ? lastRound.p1Errored : lastRound.p2Errored;
                 const intended = playerState.id === 1 ? lastRound.p1Intended : lastRound.p2Intended;
                 const score = playerState.id === 1 ? lastRound.p1Score : lastRound.p2Score;

                 choiceDisplay.textContent = choice + (errored ? ` (Feil! Var ${intended})` : '');
                 choiceDisplay.className = `choice-display ${choice === 'C' ? 'cooperate' : 'defect'} ${errored ? 'error' : ''}`;
                 roundScoreDisplay.textContent = score;
             } else {
                 choiceDisplay.textContent = '?';
                 choiceDisplay.className = 'choice-display';
                 roundScoreDisplay.textContent = '0';
             }
        };

        updatePlayerPanel(player1Panel, gameState.player1);
        updatePlayerPanel(player2Panel, gameState.player2);

        // Aktiver/deaktiver spill-knapper
        const p1Ready = gameState.player1.type === 'ai' || gameState.humanPlayer1ChoiceMade;
        const p2Ready = gameState.player2.type === 'ai' || gameState.humanPlayer2ChoiceMade;
        playRoundBtn.disabled = gameState.isGameOver || !p1Ready || !p2Ready || gameState.isTournamentRunning;
        playAllRoundsBtn.disabled = gameState.isGameOver || gameState.player1.type === 'human' || gameState.player2.type === 'human' || gameState.isTournamentRunning;

        // Vis/skjul elementer basert på spillstatus
        gameContainer.classList.toggle('hidden', gameState.isGameOver && !gameState.isTournamentRunning); // Skjul kun hvis *ikke* turnering kjører
        resultsSummaryDiv.classList.toggle('hidden', !gameState.isGameOver || gameState.isTournamentRunning);
        settingsContainer.classList.toggle('hidden', !gameState.isGameOver && !gameState.isTournamentRunning); // Vis kun når spillet er over
        customStrategyContainer.classList.toggle('hidden', !gameState.isGameOver || gameState.isTournamentRunning);
        tournamentContainer.classList.toggle('hidden', !gameState.isGameOver || gameState.isTournamentRunning);
        tournamentProgressDiv.classList.toggle('hidden', !gameState.isTournamentRunning);
        tournamentResultsContainer.classList.toggle('hidden', !gameState.isTournamentRunning); // Skjul resultater mens turnering kjører
    }


     function updateHistoryTable() {
         const tableBody = historyTableBody;
         // Optimalisering: Legg bare til siste rad i stedet for å bygge opp alt på nytt
         if (gameState.history.length > 0) {
             const roundData = gameState.history[gameState.history.length - 1];
             const row = tableBody.insertRow(); // Legger til nederst
             row.innerHTML = `
                 <td>${roundData.round}</td>
                 <td class="${roundData.p1Choice === 'C' ? 'history-cooperate' : 'history-defect'}">
                     ${roundData.p1Choice}${roundData.p1Errored ? `<span class="history-error"> (${roundData.p1Intended})</span>` : ''}
                 </td>
                 <td class="${roundData.p1Errored ? 'history-error' : ''}">${roundData.p1Errored ? 'Ja' : 'Nei'}</td>
                 <td class="${roundData.p2Choice === 'C' ? 'history-cooperate' : 'history-defect'}">
                     ${roundData.p2Choice}${roundData.p2Errored ? `<span class="history-error"> (${roundData.p2Intended})</span>` : ''}
                 </td>
                 <td class="${roundData.p2Errored ? 'history-error' : ''}">${roundData.p2Errored ? 'Ja' : 'Nei'}</td>
                 <td>${roundData.p1Score}</td>
                 <td>${roundData.p2Score}</td>
             `;
             // Scroll til bunnen
             historyContainer.scrollTop = historyContainer.scrollHeight;
         } else {
             tableBody.innerHTML = ''; // Tøm hvis historikken er nullstilt
         }
     }

    function displayFinalOutcome() {
         // Denne kjøres kun for enkelt/iterert spill, ikke turnering
         let outcomeText = `Spillet er over etter ${gameState.totalRounds} runder.<br>`;
         const p1Name = gameState.player1.type === 'human' ? 'Menneske' : allStrategies[gameState.player1.strategyKey]?.name ?? 'Ukjent AI';
         const p2Name = gameState.player2.type === 'human' ? 'Menneske' : allStrategies[gameState.player2.strategyKey]?.name ?? 'Ukjent AI';
         outcomeText += `Spiller 1 (${p1Name}) fikk ${gameState.player1.score} poeng.<br>`;
         outcomeText += `Spiller 2 (${p2Name}) fikk ${gameState.player2.score} poeng.<br>`;

         if (gameState.player1.score > gameState.player2.score) {
             outcomeText += "Spiller 1 vant!";
         } else if (gameState.player2.score > gameState.player1.score) {
             outcomeText += "Spiller 2 vant!";
         } else {
             outcomeText += "Det ble uavgjort!";
         }
         finalOutcomeP.innerHTML = outcomeText;
     }

     function getStrategyFunction(strategyKey) {
         const strategyData = allStrategies[strategyKey];
         if (!strategyData) {
             console.error(`Strategi ikke funnet: ${strategyKey}`);
             return () => 'C'; // Fallback
         }
          // For stateful strategies, ensure we have a state object
         if (strategyData.reset && !strategyData.state) {
              strategyData.state = {}; // Initialiser state hvis nødvendig
              strategyData.reset();   // Kjør reset-funksjonen
         }
         return strategyData.fn;
     }

     function getPlayerChoice(playerState, opponentState, currentHistory) {
         if (playerState.type === 'human') {
             return playerState.choice; // Hentet fra knappetrykk
         } else {
             const strategyFn = getStrategyFunction(playerState.strategyKey);
             const playerHistoryForAI = currentHistory.map(h => playerState.id === 1 ?
                 { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored } :
                 { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored }
             );
             const opponentHistoryForAI = currentHistory.map(h => playerState.id === 1 ?
                 { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored } :
                 { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored }
             );

             try {
                   // Kall med 'state' som 'this' hvis strategien har det
                   const strategyData = allStrategies[playerState.strategyKey];
                   if (strategyData && strategyData.state) {
                       return strategyFn.call(strategyData, playerHistoryForAI, opponentHistoryForAI);
                   } else {
                       return strategyFn(playerHistoryForAI, opponentHistoryForAI);
                   }
             } catch (error) {
                 console.error(`Feil ved kjøring av strategi ${playerState.strategyKey}:`, error);
                 // Vis feilmelding til bruker?
                 return 'C'; // Fallback ved feil i strategi-kode
             }
         }
     }

    function applyNoise(intendedChoice, noisePercent) {
        const didError = Math.random() * 100 < noisePercent;
        const actualChoice = didError ? (intendedChoice === 'C' ? 'D' : 'C') : intendedChoice;
        return { choice: actualChoice, errored: didError, intended: intendedChoice };
    }

     // Forenklet logikk for bruk i turnering (ingen UI-oppdatering per trekk)
     function playSingleRoundLogic(tempGameState) {
         const intendedP1 = getPlayerChoice(tempGameState.player1, tempGameState.player2, tempGameState.history);
         const intendedP2 = getPlayerChoice(tempGameState.player2, tempGameState.player1, tempGameState.history);

         if (intendedP1 !== 'C' && intendedP1 !== 'D') intendedP1 = 'C'; // Valider output
         if (intendedP2 !== 'C' && intendedP2 !== 'D') intendedP2 = 'C'; // Valider output

         const resultP1 = applyNoise(intendedP1, tempGameState.noiseLevel);
         const resultP2 = applyNoise(intendedP2, tempGameState.noiseLevel);

         const payoff = tempGameState.payoffs[resultP1.choice][resultP2.choice];
         tempGameState.player1.score += payoff.p1;
         tempGameState.player2.score += payoff.p2;

         tempGameState.currentRound++;
         tempGameState.history.push({
             round: tempGameState.currentRound,
             p1Choice: resultP1.choice, p1Intended: resultP1.intended, p1Errored: resultP1.errored,
             p2Choice: resultP2.choice, p2Intended: resultP2.intended, p2Errored: resultP2.errored,
             p1Score: payoff.p1,
             p2Score: payoff.p2
         });
     }


     function playSingleRoundUI() {
         if (gameState.isGameOver || gameState.isTournamentRunning) return;

         const intendedP1 = getPlayerChoice(gameState.player1, gameState.player2, gameState.history);
         const intendedP2 = getPlayerChoice(gameState.player2, gameState.player1, gameState.history);

          // Validering og fallback (spesielt for menneskelig input som kanskje ikke er satt)
         if (!intendedP1) { console.log("Spiller 1 har ikke valgt."); return; }
         if (!intendedP2) { console.log("Spiller 2 har ikke valgt."); return; }
         if (intendedP1 !== 'C' && intendedP1 !== 'D') intendedP1 = 'C';
         if (intendedP2 !== 'C' && intendedP2 !== 'D') intendedP2 = 'C';

         const resultP1 = applyNoise(intendedP1, gameState.noiseLevel);
         const resultP2 = applyNoise(intendedP2, gameState.noiseLevel);

         const payoff = gameState.payoffs[resultP1.choice][resultP2.choice];
         gameState.player1.score += payoff.p1;
         gameState.player2.score += payoff.p2;

         gameState.currentRound++;
         const roundData = {
             round: gameState.currentRound,
             p1Choice: resultP1.choice, p1Intended: resultP1.intended, p1Errored: resultP1.errored,
             p2Choice: resultP2.choice, p2Intended: resultP2.intended, p2Errored: resultP2.errored,
             p1Score: payoff.p1,
             p2Score: payoff.p2
         };
         gameState.history.push(roundData);

         // Nullstill for menneskelige spillere
         gameState.player1.choice = null;
         gameState.player2.choice = null;
         gameState.humanPlayer1ChoiceMade = false;
         gameState.humanPlayer2ChoiceMade = false;

         if (gameState.currentRound >= gameState.totalRounds) {
             gameState.isGameOver = true;
              if(gameState.gameInterval) clearInterval(gameState.gameInterval);
              gameState.gameInterval = null;
              $('#play-all-rounds-btn').textContent = "Spill Alle Gjenstående";
              displayFinalOutcome(); // Vis oppsummering for enkeltspill
         }

         updateUI();
         updateHistoryTable();
     }

    function playAllRoundsUI() {
         if (gameState.gameInterval) {
             clearInterval(gameState.gameInterval);
             gameState.gameInterval = null;
             playAllRoundsBtn.textContent = "Spill Alle Gjenstående";
             playAllRoundsBtn.disabled = gameState.isGameOver; // Re-enable if not over
             return;
         }

        // Kan ikke autospille med mennesker
         if (gameState.player1.type === 'human' || gameState.player2.type === 'human') {
             alert("Kan ikke autospille når en eller flere spillere er menneske.");
             return;
         }


         playAllRoundsBtn.textContent = "Stopp Autospill";
         playAllRoundsBtn.disabled = false; // Ensure it's enabled while running

         gameState.gameInterval = setInterval(() => {
             if (!gameState.isGameOver) {
                 playSingleRoundUI(); // Bruk UI-versjonen her
             } else {
                 clearInterval(gameState.gameInterval);
                 gameState.gameInterval = null;
                 playAllRoundsBtn.textContent = "Spill Alle Gjenstående";
                 playAllRoundsBtn.disabled = true; // Disable when done
             }
         }, gameState.playSpeed);
     }

    function resetGame() {
        if (gameState.gameInterval) clearInterval(gameState.gameInterval);
        gameState.gameInterval = null;
         gameState.isTournamentRunning = false; // Sørg for at turnering ikke blokkerer

        gameState.player1.type = player1TypeSelect.value;
        gameState.player2.type = player2TypeSelect.value;
        gameState.player1.strategyKey = player1StrategySelect.value;
        gameState.player2.strategyKey = player2StrategySelect.value;
        gameState.totalRounds = parseInt(numRoundsInput.value) || 10;
        gameState.noiseLevel = parseInt(noiseLevelInput.value) || 0;
        gameState.playSpeed = parseInt(playSpeedSlider.value) || 500;

        gameState.player1.score = 0;
        gameState.player2.score = 0;
        gameState.player1.choice = null;
        gameState.player2.choice = null;
        gameState.history = [];
        gameState.currentRound = 0;
        gameState.isGameOver = false;
        gameState.humanPlayer1ChoiceMade = false;
        gameState.humanPlayer2ChoiceMade = false;

        // Nullstill state for stateful strategier
        Object.values(allStrategies).forEach(strat => {
            if (strat.reset) strat.reset();
        });

        historyTableBody.innerHTML = '';
        finalOutcomeP.innerHTML = '';
        playAllRoundsBtn.textContent = "Spill Alle Gjenstående";
        tournamentResultsTableBody.innerHTML = ''; // Tøm turneringsresultater også


        updateUI();
    }

     function addCustomStrategy() {
         const name = customStrategyNameInput.value.trim();
         const code = customStrategyCodeTextarea.value.trim();
         const key = name.toLowerCase().replace(/\s+/g, ''); // Lag en nøkkel

         if (!name || !code || !key) {
             alert("Vennligst oppgi både navn og kode for strategien.");
             return;
         }
         if (allStrategies[key]) {
             alert("En strategi med dette navnet (eller lignende nøkkel) finnes allerede.");
             return;
         }

         try {
             // Prøv å lage funksjonen. Andre parameternavn kan brukes internt i koden.
             const strategyFn = new Function('playerHistory', 'opponentHistory', `
                 // Sikkerhetstiltak: Begrens tilgang til global scope (fungerer ikke perfekt)
                 // 'use strict'; // Kan hjelpe litt
                 // const window = undefined;
                 // const document = undefined;
                 // ... (flere kan legges til, men det er vanskelig å dekke alt)
                 try {
                     ${code}
                 } catch (e) {
                     console.error("Feil i egendefinert strategi '${name}':", e);
                     // Returner et trygt standardvalg ved feil
                     return 'C';
                 }
             `);

             // Test funksjonen (valgfritt, men lurt)
             const testResult = strategyFn([], []);
             if (testResult !== 'C' && testResult !== 'D') {
                  throw new Error("Strategien må returnere 'C' eller 'D'. Fikk: " + testResult);
             }

             allStrategies[key] = { name: name, isCustom: true, fn: strategyFn };
             console.log(`Egendefinert strategi "${name}" lagt til med nøkkel "${key}".`);
             populateStrategyDropdowns(); // Oppdater alle dropdowns
             populateTournamentStrategyList(); // Oppdater turneringslisten
             customStrategyNameInput.value = ''; // Tøm feltene
             customStrategyCodeTextarea.value = '';
             alert(`Strategien "${name}" ble lagt til!`);

         } catch (error) {
             alert("Kunne ikke legge til strategi. Sjekk koden for feil.\nFeilmelding: " + error.message);
             console.error("Feil ved parsing/testing av egendefinert strategi:", error);
         }
     }

    // --- Turneringslogikk ---
    async function runTournament() {
        if (gameState.isTournamentRunning) return; // Ikke start ny hvis en kjører

        gameState.isTournamentRunning = true;
        startTournamentBtn.disabled = true;
        startTournamentBtn.textContent = "Turnering Kjører...";
        tournamentResultsContainer.classList.add('hidden'); // Skjul gamle resultater
        tournamentProgressDiv.classList.remove('hidden');
        updateUI(); // Oppdater knapper etc.

        const selectedStrategies = [];
        $$('#tournament-strategy-list input[type="checkbox"]:checked').forEach(cb => {
            selectedStrategies.push(cb.value);
        });

        if (selectedStrategies.length < 2) {
            alert("Vennligst velg minst to strategier for turneringen.");
            gameState.isTournamentRunning = false;
            startTournamentBtn.disabled = false;
            startTournamentBtn.textContent = "Start Turnering";
             tournamentProgressDiv.classList.add('hidden');
             updateUI();
            return;
        }

        const tournamentScores = {};
        selectedStrategies.forEach(key => { tournamentScores[key] = 0; });

        const roundsPerGame = parseInt(numRoundsInput.value) || 200; // Bruk runder fra innstillinger
        const noisePercent = parseInt(noiseLevelInput.value) || 0;
        const totalGames = selectedStrategies.length * selectedStrategies.length;
        let gamesPlayed = 0;

        // Dobbel løkke for round-robin
        for (let i = 0; i < selectedStrategies.length; i++) {
            for (let j = 0; j < selectedStrategies.length; j++) {
                 gamesPlayed++;
                 tournamentProgressDiv.textContent = `Kjører spill ${gamesPlayed} av ${totalGames}... (${allStrategies[selectedStrategies[i]].name} vs ${allStrategies[selectedStrategies[j]].name})`;

                 // Lag midlertidig spilltilstand for dette paret
                 const tempGameState = {
                     player1: { id: 1, score: 0, type: 'ai', strategyKey: selectedStrategies[i], choice: null, intendedChoice: null, errored: false },
                     player2: { id: 2, score: 0, type: 'ai', strategyKey: selectedStrategies[j], choice: null, intendedChoice: null, errored: false },
                     history: [],
                     currentRound: 0,
                     totalRounds: roundsPerGame,
                     noiseLevel: noisePercent,
                      payoffs: gameState.payoffs // Bruk samme payoffs
                 };

                  // Nullstill state for stateful strategier FØR spillet starter
                  if (allStrategies[tempGameState.player1.strategyKey]?.reset) allStrategies[tempGameState.player1.strategyKey].reset();
                  if (allStrategies[tempGameState.player2.strategyKey]?.reset) allStrategies[tempGameState.player2.strategyKey].reset();


                 // Kjør spillet
                 for (let r = 0; r < roundsPerGame; r++) {
                     playSingleRoundLogic(tempGameState);
                 }

                 // Legg til poeng i turneringstotalen
                 tournamentScores[selectedStrategies[i]] += tempGameState.player1.score;
                 // Ikke dobbeltell poengsummen når en strategi spiller mot seg selv
                 if (i !== j) {
                     tournamentScores[selectedStrategies[j]] += tempGameState.player2.score;
                 } else {
                      // Når en strategi spiller mot seg selv, teller vi poengsummen én gang for gjennomsnittet
                      // Justering: Vi trenger totalpoeng for rangering, så la den telle.
                      // Gjennomsnittet justeres senere.
                      // tournamentScores[selectedStrategies[j]] += tempGameState.player2.score; // Teller begge spilleres score fra selv-spill
                 }


                 // Liten pause for å la UI oppdatere (viktig!)
                 await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Beregn og vis resultater
         displayTournamentResults(tournamentScores, selectedStrategies.length, roundsPerGame);

        gameState.isTournamentRunning = false;
        gameState.isGameOver = true; // Sett spillet til over når turneringen er ferdig
        startTournamentBtn.disabled = false;
        startTournamentBtn.textContent = "Start Turnering";
        tournamentProgressDiv.classList.add('hidden');
        tournamentResultsContainer.classList.remove('hidden');
        updateUI(); // Oppdater UI for å vise resultater og aktivere innstillinger
    }

     function displayTournamentResults(scores, numStrategies, roundsPerGame) {
         const results = [];
         for (const key in scores) {
              // Gjennomsnitt = Total poengsum / (Antall motstandere * Antall runder per spill)
              // Antall motstandere = numStrategies (inkluderer spill mot seg selv)
             const averageScore = scores[key] / (numStrategies * roundsPerGame);
             results.push({ key: key, name: allStrategies[key].name, score: scores[key], average: averageScore });
         }

         results.sort((a, b) => b.average - a.average); // Sorter etter gjennomsnittlig poengsum

         tournamentResultsTableBody.innerHTML = '';
         results.forEach((result, index) => {
             const row = tournamentResultsTableBody.insertRow();
             row.innerHTML = `
                 <td>${index + 1}</td>
                 <td>${result.name}${allStrategies[result.key].isCustom ? ' (Egen)' : ''}</td>
                 <td>${result.average.toFixed(2)}</td>
             `;
         });
     }


    // --- Event Listeners (Tillegg og justeringer) ---
    startGameBtn.addEventListener('click', resetGame);

    $$('.choice-btn').forEach(button => {
        button.addEventListener('click', (e) => {
             if (gameState.isGameOver || gameState.isTournamentRunning) return;

             const player = e.target.dataset.player;
             const choice = e.target.dataset.choice;
             const panel = player === '1' ? player1Panel : player2Panel;
             const playerState = player === '1' ? gameState.player1 : gameState.player2;

             if (playerState.type === 'human') {
                 playerState.choice = choice;
                 if (player === '1') gameState.humanPlayer1ChoiceMade = true;
                 else gameState.humanPlayer2ChoiceMade = true;

                 panel.querySelectorAll('.choice-btn').forEach(btn => btn.classList.remove('selected'));
                 e.target.classList.add('selected');
             }
             updateUI(); // Oppdater knappestatus etc.
        });
    });

    playRoundBtn.addEventListener('click', playSingleRoundUI);
    playAllRoundsBtn.addEventListener('click', playAllRoundsUI);

    player1TypeSelect.addEventListener('change', (e) => {
        gameState.player1.type = e.target.value;
        resetGame(); // Nullstill spillet når type endres for enkelhets skyld
        // updateUI();
    });
    player2TypeSelect.addEventListener('change', (e) => {
        gameState.player2.type = e.target.value;
        resetGame(); // Nullstill spillet
        // updateUI();
    });

    player1StrategySelect.addEventListener('change', (e) => gameState.player1.strategyKey = e.target.value);
    player2StrategySelect.addEventListener('change', (e) => gameState.player2.strategyKey = e.target.value);

    playSpeedSlider.addEventListener('input', (e) => {
         const newSpeed = parseInt(e.target.value);
         gameState.playSpeed = newSpeed;
         speedValueSpan.textContent = newSpeed;
         if (gameState.gameInterval) {
             clearInterval(gameState.gameInterval);
              // Ikke start automatisk på nytt ved endring under kjøring
             playAllRoundsBtn.textContent = "Spill Alle Gjenstående";
              playAllRoundsBtn.disabled = false;
             gameState.gameInterval = null; // Nullstill intervallet
         }
     });

    showSettingsBtn.addEventListener('click', () => {
         gameState.isGameOver = true; // Sørg for at vi er i "settings mode"
         gameState.isTournamentRunning = false; // Sørg for at turnering ikke kjører
         tournamentResultsContainer.classList.add('hidden'); // Skjul turneringsresultater
         updateUI(); // Skal vise settings nå
    });

    addCustomStrategyBtn.addEventListener('click', addCustomStrategy);
    startTournamentBtn.addEventListener('click', runTournament);


    // --- Initialisering ---
    populateStrategyDropdowns();
    populateTournamentStrategyList();
    resetGame(); // Start med å resette og vise innstillinger
    updateUI(); // Sørger for at UI er korrekt

});
