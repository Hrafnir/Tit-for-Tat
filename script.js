document.addEventListener('DOMContentLoaded', () => {
    // --- Globale variabler og tilstand ---
    let gameState = {
        player1: { score: 0, type: 'human', strategy: null, choice: null, errored: false },
        player2: { score: 0, type: 'ai', strategy: 'titForTat', choice: null, errored: false },
        history: [], // { round: #, p1Choice: 'C'/'D', p1Intended: 'C'/'D', p1Errored: bool, p2Choice: 'C'/'D', p2Intended: 'C'/'D', p2Errored: bool, p1Score: #, p2Score: # }
        currentRound: 0,
        totalRounds: 10,
        noiseLevel: 0, // Prosent
        payoffs: {
            'C': { 'C': { p1: 3, p2: 3 }, 'D': { p1: 0, p2: 5 } },
            'D': { 'C': { p1: 5, p2: 0 }, 'D': { p1: 1, p2: 1 } }
        },
        gameInterval: null,
        playSpeed: 500,
        humanPlayer1ChoiceMade: false,
        humanPlayer2ChoiceMade: false,
        isGameOver: false
    };

    // --- AI Strategier ---
    const strategies = {
        alwaysCooperate: { name: "Alltid Samarbeid", fn: (pHistory, oHistory) => 'C' },
        alwaysDefect: { name: "Alltid Svik", fn: (pHistory, oHistory) => 'D' },
        randomChoice: { name: "Tilfeldig", fn: (pHistory, oHistory) => Math.random() < 0.5 ? 'C' : 'D' },
        titForTat: {
            name: "Tit For Tat (TFT)",
            fn: (pHistory, oHistory) => {
                if (oHistory.length === 0) return 'C'; // Samarbeid første runde
                return oHistory[oHistory.length - 1].choice; // Kopier motstanders siste *faktiske* trekk
            }
        },
        grimTrigger: {
            name: "Grim Trigger",
            hasDefected: false, // Strategy-specific state
            fn: function(pHistory, oHistory) {
                 if (this.resetFlag) { this.hasDefected = false; this.resetFlag = false; } // Reset state on new game
                if (this.hasDefected) return 'D';
                if (oHistory.length > 0 && oHistory[oHistory.length - 1].choice === 'D') {
                    this.hasDefected = true;
                    return 'D';
                }
                return 'C';
            },
             resetFlag: true // Flag to trigger state reset
        },
         joss: {
            name: "Joss (Sleip TFT)",
             fn: (pHistory, oHistory) => {
                 if (oHistory.length === 0) return 'C';
                 const opponentLastMove = oHistory[oHistory.length - 1].choice;
                 if (opponentLastMove === 'C') {
                     // Ca 10% sjanse for å svike uansett
                     return Math.random() < 0.1 ? 'D' : 'C';
                 } else {
                     return 'D'; // Defect if opponent defected
                 }
             }
         },
         titForTwoTats: {
             name: "Tit For Two Tats (TFT2T)",
             fn: (pHistory, oHistory) => {
                 if (oHistory.length < 2) return 'C'; // Cooperate first two rounds
                 const opponentLastTwo = oHistory.slice(-2).map(h => h.choice);
                 if (opponentLastTwo[0] === 'D' && opponentLastTwo[1] === 'D') {
                     return 'D';
                 }
                 return 'C';
             }
         },
        generousTitForTat: {
            name: "Generous Tit For Tat (GTFT)",
            fn: (pHistory, oHistory) => {
                if (oHistory.length === 0) return 'C';
                const opponentLastMove = oHistory[oHistory.length - 1].choice;
                if (opponentLastMove === 'D') {
                    // 10% chance to forgive (cooperate anyway)
                    return Math.random() < 0.1 ? 'C' : 'D';
                }
                return 'C'; // Cooperate if opponent cooperated
            }
        },
        // --- Flere strategier kan legges til her ---
        // Tester, Pavlov, etc.
    };

     // --- Hjelpefunksjoner ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    function populateStrategyDropdowns() {
        const selects = $$('#player1-strategy, #player2-strategy');
        selects.forEach(select => {
            select.innerHTML = ''; // Tøm eksisterende
            for (const key in strategies) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = strategies[key].name;
                select.appendChild(option);
            }
        });
         // Sett standardvalg (kan justeres)
        $('#player1-strategy').value = 'titForTat';
        $('#player2-strategy').value = 'titForTat';
    }

    function updateUI() {
        // Oppdater rundeteller
        $('#current-round').textContent = gameState.currentRound;
        $('#total-rounds').textContent = gameState.totalRounds;

        // Oppdater Spiller 1 panel
        const p1Panel = $('#player1-panel');
        p1Panel.querySelector('.player-type').textContent = gameState.player1.type === 'human' ? 'Menneske' : 'AI';
        p1Panel.querySelector('.total-score').textContent = gameState.player1.score;
        const p1StrategyDisplay = p1Panel.querySelector('.strategy-display');
        if (gameState.player1.type === 'ai') {
            p1StrategyDisplay.textContent = `Strategi: ${strategies[gameState.player1.strategy].name}`;
            p1StrategyDisplay.classList.remove('hidden');
            p1Panel.querySelector('.human-controls').classList.add('hidden');
        } else {
            p1StrategyDisplay.classList.add('hidden');
             p1Panel.querySelector('.human-controls').classList.remove('hidden');
        }
        // Oppdater valg og runde-poeng KUN hvis et trekk er gjort i runden
        const p1ChoiceDisplay = p1Panel.querySelector('.choice-display');
        const p1RoundScore = p1Panel.querySelector('.round-score');
        if (gameState.history.length > 0 && gameState.history.length === gameState.currentRound) { // Viser siste runde
            const lastRound = gameState.history[gameState.currentRound - 1];
            p1ChoiceDisplay.textContent = lastRound.p1Choice + (lastRound.p1Errored ? ' (Feil!)' : '');
            p1ChoiceDisplay.className = `choice-display ${lastRound.p1Choice === 'C' ? 'cooperate' : 'defect'} ${lastRound.p1Errored ? 'error' : ''}`;
            p1RoundScore.textContent = lastRound.p1Score;
        } else { // Nullstill for ny runde eller før start
             p1ChoiceDisplay.textContent = '?';
             p1ChoiceDisplay.className = 'choice-display';
             p1RoundScore.textContent = '0';
        }


         // Oppdater Spiller 2 panel (lignende logikk)
        const p2Panel = $('#player2-panel');
        p2Panel.querySelector('.player-type').textContent = gameState.player2.type === 'human' ? 'Menneske' : 'AI';
        p2Panel.querySelector('.total-score').textContent = gameState.player2.score;
         const p2StrategyDisplay = p2Panel.querySelector('.strategy-display');
         if (gameState.player2.type === 'ai') {
             p2StrategyDisplay.textContent = `Strategi: ${strategies[gameState.player2.strategy].name}`;
             p2StrategyDisplay.classList.remove('hidden');
             p2Panel.querySelector('.human-controls').classList.add('hidden');
         } else {
             p2StrategyDisplay.classList.add('hidden');
             p2Panel.querySelector('.human-controls').classList.remove('hidden');
         }
        const p2ChoiceDisplay = p2Panel.querySelector('.choice-display');
        const p2RoundScore = p2Panel.querySelector('.round-score');
        if (gameState.history.length > 0 && gameState.history.length === gameState.currentRound) { // Viser siste runde
             const lastRound = gameState.history[gameState.currentRound - 1];
             p2ChoiceDisplay.textContent = lastRound.p2Choice + (lastRound.p2Errored ? ' (Feil!)' : '');
             p2ChoiceDisplay.className = `choice-display ${lastRound.p2Choice === 'C' ? 'cooperate' : 'defect'} ${lastRound.p2Errored ? 'error' : ''}`;
             p2RoundScore.textContent = lastRound.p2Score;
         } else {
             p2ChoiceDisplay.textContent = '?';
             p2ChoiceDisplay.className = 'choice-display';
             p2RoundScore.textContent = '0';
         }

         // Aktiver/deaktiver spill-knapp
        $('#play-round-btn').disabled = gameState.isGameOver ||
                                       (gameState.player1.type === 'human' && !gameState.humanPlayer1ChoiceMade) ||
                                       (gameState.player2.type === 'human' && !gameState.humanPlayer2ChoiceMade);
        $('#play-all-rounds-btn').disabled = gameState.isGameOver;

        // Vis/skjul innstillinger vs spill
         if (gameState.isGameOver) {
             $('.game-container').classList.add('hidden');
             $('.results-summary').classList.remove('hidden');
              $('.settings-container').classList.remove('hidden');
             displayFinalOutcome();
         } else if (gameState.currentRound === 0 && gameState.history.length === 0) { // Før spillet starter
             $('.game-container').classList.add('hidden');
              $('.results-summary').classList.add('hidden');
             $('.settings-container').classList.remove('hidden');
         } else { // Spillet pågår
             $('.game-container').classList.remove('hidden');
             $('.results-summary').classList.add('hidden');
             $('.settings-container').classList.add('hidden');
         }
         // Oppdater synlighet av AI-strategivalg basert på spillertype
        $('.ai-setting.player1').style.display = gameState.player1.type === 'ai' ? 'flex' : 'none';
        $('.ai-setting.player2').style.display = gameState.player2.type === 'ai' ? 'flex' : 'none';
    }

    function updateHistoryTable() {
        const tableBody = $('#history-table tbody');
        tableBody.innerHTML = ''; // Tøm tabellen
        gameState.history.forEach(roundData => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${roundData.round}</td>
                <td class="${roundData.p1Choice === 'C' ? 'history-cooperate' : 'history-defect'}">
                    ${roundData.p1Choice}${roundData.p1Errored ? '<span class="history-error"> (Intensjon: '+roundData.p1Intended+')</span>' : ''}
                </td>
                <td class="${roundData.p1Errored ? 'history-error' : ''}">${roundData.p1Errored ? 'Ja' : 'Nei'}</td>
                 <td class="${roundData.p2Choice === 'C' ? 'history-cooperate' : 'history-defect'}">
                    ${roundData.p2Choice}${roundData.p2Errored ? '<span class="history-error"> (Intensjon: '+roundData.p2Intended+')</span>' : ''}
                </td>
                 <td class="${roundData.p2Errored ? 'history-error' : ''}">${roundData.p2Errored ? 'Ja' : 'Nei'}</td>
                <td>${roundData.p1Score}</td>
                <td>${roundData.p2Score}</td>
            `;
        });
         // Scroll til bunnen
         const historyContainer = $('.history-container');
         historyContainer.scrollTop = historyContainer.scrollHeight;
    }

    function displayFinalOutcome() {
         let outcomeText = `Spillet er over etter ${gameState.totalRounds} runder.<br>`;
         outcomeText += `Spiller 1 (${gameState.player1.type === 'human' ? 'Menneske' : strategies[gameState.player1.strategy].name}) fikk ${gameState.player1.score} poeng.<br>`;
         outcomeText += `Spiller 2 (${gameState.player2.type === 'human' ? 'Menneske' : strategies[gameState.player2.strategy].name}) fikk ${gameState.player2.score} poeng.<br>`;

         if (gameState.player1.score > gameState.player2.score) {
             outcomeText += "Spiller 1 vant!";
         } else if (gameState.player2.score > gameState.player1.score) {
             outcomeText += "Spiller 2 vant!";
         } else {
             outcomeText += "Det ble uavgjort!";
         }
          $('#final-outcome').innerHTML = outcomeText;
     }


    function getPlayerChoice(playerNum) {
        const player = playerNum === 1 ? gameState.player1 : gameState.player2;
        if (player.type === 'human') {
            // Vent på knappetrykk, returnerer null hvis ikke valgt
            return player.choice;
        } else {
            // Kjør AI-strategi
            const strategyFn = strategies[player.strategy].fn;
             // Lag historikk kun for den *andre* spilleren
            const opponentHistory = gameState.history.map(h => playerNum === 1 ?
                 { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored } :
                 { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored }
             );
            const playerHistory = gameState.history.map(h => playerNum === 1 ?
                  { choice: h.p1Choice, intended: h.p1Intended, errored: h.p1Errored } :
                  { choice: h.p2Choice, intended: h.p2Intended, errored: h.p2Errored }
              );
             // For stateful strategies like Grim Trigger
             if (typeof strategyFn === 'function') {
                  // Pass 'this' context if the strategy function needs it for state
                  if (strategies[player.strategy].hasDefected !== undefined) {
                       return strategyFn.call(strategies[player.strategy], playerHistory, opponentHistory);
                  } else {
                      return strategyFn(playerHistory, opponentHistory);
                  }
             } else {
                 console.error("Strategy function not found for:", player.strategy);
                 return 'C'; // Default or error handling
             }
        }
    }

    function applyNoise(intendedChoice) {
        const didError = Math.random() * 100 < gameState.noiseLevel;
        const actualChoice = didError ? (intendedChoice === 'C' ? 'D' : 'C') : intendedChoice;
        return { choice: actualChoice, errored: didError, intended: intendedChoice };
    }

     function playSingleRound() {
         if (gameState.isGameOver) return;

         // 1. Få intensjonen til hver spiller
         const intendedP1 = gameState.player1.type === 'human' ? gameState.player1.choice : getPlayerChoice(1);
         const intendedP2 = gameState.player2.type === 'human' ? gameState.player2.choice : getPlayerChoice(2);

          // Sjekk om menneskelige spillere har valgt (hvis relevant)
         if ((gameState.player1.type === 'human' && !intendedP1) || (gameState.player2.type === 'human' && !intendedP2)) {
             console.log("Venter på menneskelig valg...");
              return; // Ikke spill runden før begge har valgt
         }

         // 2. Bruk støy for å bestemme faktisk valg
         const resultP1 = applyNoise(intendedP1);
         const resultP2 = applyNoise(intendedP2);

         // 3. Beregn poeng basert på *faktiske* valg
         const payoff = gameState.payoffs[resultP1.choice][resultP2.choice];
         gameState.player1.score += payoff.p1;
         gameState.player2.score += payoff.p2;

         // 4. Oppdater historikk
         gameState.currentRound++;
         const roundData = {
             round: gameState.currentRound,
             p1Choice: resultP1.choice, p1Intended: resultP1.intended, p1Errored: resultP1.errored,
             p2Choice: resultP2.choice, p2Intended: resultP2.intended, p2Errored: resultP2.errored,
             p1Score: payoff.p1,
             p2Score: payoff.p2
         };
         gameState.history.push(roundData);

         // 5. Nullstill valg for menneskelige spillere for neste runde
         gameState.player1.choice = null;
         gameState.player2.choice = null;
         gameState.humanPlayer1ChoiceMade = false;
         gameState.humanPlayer2ChoiceMade = false;
         $$('.choice-btn').forEach(btn => btn.classList.remove('selected')); // Fjern visuell markering


         // 6. Sjekk om spillet er over
         if (gameState.currentRound >= gameState.totalRounds) {
             gameState.isGameOver = true;
             console.log("Spill over!");
              if(gameState.gameInterval) clearInterval(gameState.gameInterval);
         }

         // 7. Oppdater UI
         updateUI();
         updateHistoryTable(); // Oppdater historikktabellen også
     }


    function playAllRounds() {
         if (gameState.gameInterval) {
             clearInterval(gameState.gameInterval); // Stopp hvis allerede i gang
             gameState.gameInterval = null;
             $('#play-all-rounds-btn').textContent = "Spill Alle Gjenstående";
             return;
         }

         $('#play-all-rounds-btn').textContent = "Stopp Autospill";

         // Hvis noen spillere er mennesker, kan vi ikke autospille
         if (gameState.player1.type === 'human' || gameState.player2.type === 'human') {
             alert("Kan ikke autospille når en eller flere spillere er menneske.");
             $('#play-all-rounds-btn').textContent = "Spill Alle Gjenstående";
             return;
         }


         gameState.gameInterval = setInterval(() => {
             if (!gameState.isGameOver) {
                 playSingleRound();
             } else {
                 clearInterval(gameState.gameInterval);
                 gameState.gameInterval = null;
                  $('#play-all-rounds-btn').textContent = "Spill Alle Gjenstående";
             }
         }, gameState.playSpeed);
     }

     function resetGame() {
         if (gameState.gameInterval) clearInterval(gameState.gameInterval);
         gameState.gameInterval = null;

         // Les innstillinger
         gameState.player1.type = $('#player1-type').value;
         gameState.player2.type = $('#player2-type').value;
         gameState.player1.strategy = $('#player1-strategy').value;
         gameState.player2.strategy = $('#player2-strategy').value;
         gameState.totalRounds = parseInt($('#num-rounds').value) || 10;
         gameState.noiseLevel = parseInt($('#noise-level').value) || 0;
         gameState.playSpeed = parseInt($('#play-speed').value) || 500;


         // Nullstill spilltilstand
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
         if (strategies.grimTrigger) strategies.grimTrigger.resetFlag = true;
         // ... nullstill andre stateful strategier her ...

          $('#history-table tbody').innerHTML = ''; // Tøm historikktabell-visning
          $('#final-outcome').innerHTML = ''; // Tøm resultatvisning
         $('#play-all-rounds-btn').textContent = "Spill Alle Gjenstående";
          $$('.choice-btn').forEach(btn => btn.classList.remove('selected'));


         updateUI();
     }

    // --- Event Listeners ---
    $('#start-game-btn').addEventListener('click', resetGame);

    $$('.choice-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (gameState.isGameOver) return;

            const player = e.target.dataset.player;
            const choice = e.target.dataset.choice;

            if (player === '1' && gameState.player1.type === 'human') {
                gameState.player1.choice = choice;
                gameState.humanPlayer1ChoiceMade = true;
                // Fjern 'selected' fra andre P1-knapper, legg til på denne
                 $$('#player1-panel .choice-btn').forEach(btn => btn.classList.remove('selected'));
                 e.target.classList.add('selected');
            } else if (player === '2' && gameState.player2.type === 'human') {
                gameState.player2.choice = choice;
                gameState.humanPlayer2ChoiceMade = true;
                 // Fjern 'selected' fra andre P2-knapper, legg til på denne
                 $$('#player2-panel .choice-btn').forEach(btn => btn.classList.remove('selected'));
                 e.target.classList.add('selected');
            }

            // Hvis begge er mennesker og begge har valgt, ELLER hvis en er AI og mennesket har valgt
            if ((gameState.player1.type === 'human' && gameState.humanPlayer1ChoiceMade && gameState.player2.type === 'ai') ||
                (gameState.player2.type === 'human' && gameState.humanPlayer2ChoiceMade && gameState.player1.type === 'ai') ||
                (gameState.player1.type === 'human' && gameState.humanPlayer1ChoiceMade && gameState.player2.type === 'human' && gameState.humanPlayer2ChoiceMade))
             {
                $('#play-round-btn').disabled = false;
             }
             // Hvis begge er AI, er knappen allerede aktivert etter reset
             else if (gameState.player1.type === 'ai' && gameState.player2.type === 'ai'){
                 $('#play-round-btn').disabled = false;
             }
              else {
                  $('#play-round-btn').disabled = true;
              }
        });
    });

    $('#play-round-btn').addEventListener('click', playSingleRound);
    $('#play-all-rounds-btn').addEventListener('click', playAllRounds);

     $('#player1-type').addEventListener('change', (e) => {
         gameState.player1.type = e.target.value;
         updateUI(); // Oppdater synlighet av strategivalg etc.
         // Nullstill spillet hvis type endres? Kan vurderes.
     });
     $('#player2-type').addEventListener('change', (e) => {
         gameState.player2.type = e.target.value;
         updateUI();
     });

    $('#player1-strategy').addEventListener('change', (e) => gameState.player1.strategy = e.target.value);
    $('#player2-strategy').addEventListener('change', (e) => gameState.player2.strategy = e.target.value);

    $('#play-speed').addEventListener('input', (e) => {
         gameState.playSpeed = parseInt(e.target.value);
         $('#speed-value').textContent = gameState.playSpeed;
         if (gameState.gameInterval) { // Juster intervall hvis autospill kjører
             clearInterval(gameState.gameInterval);
             playAllRounds(); // Start på nytt med ny hastighet
              $('#play-all-rounds-btn').textContent = "Stopp Autospill"; // Sørg for at teksten er riktig
         }
     });

      $('#show-settings-btn').addEventListener('click', () => {
          $('.game-container').classList.add('hidden');
          $('.results-summary').classList.add('hidden');
          $('.settings-container').classList.remove('hidden');
      });


    // --- Initialisering ---
    populateStrategyDropdowns();
    resetGame(); // Setter opp standardverdier og UI
    updateUI(); // Sørger for at UI er korrekt før første interaksjon

});
