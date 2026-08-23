var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;
var currentAiDepth = 1; // عمق افتراضي للذكاء الاصطناعي

window.addEventListener('DOMContentLoaded', (event) => {
    var randomBg = Math.floor(Math.random() * 3) + 1;
    document.body.style.backgroundImage = `linear-gradient(rgba(7, 9, 14, 0.85), rgba(7, 9, 14, 0.85)), url('images/${randomBg}.jfif')`;

    if (window.location.pathname.includes('game.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const lvl = parseInt(urlParams.get('level')) || 1;
        
        // تحديد صعوبة وعمق تفكير الخصم تلقائياً حسب رقم المستوى
        if (lvl <= 3) {
            currentAiDepth = 1; // مستويات سهلة
        } else if (lvl <= 7) {
            currentAiDepth = 2; // مستويات متوسطة
        } else if (lvl <= 10) {
            currentAiDepth = 3; // مستويات صعبة
        } else {
            currentAiDepth = 4; // مستوى أيانوكوجي الأسطوري
        }

        updateEnemyInfo(lvl);
        startGame('white');
    }
});

function startGame(color) {
    playerColor = color;
    var gameOverModal = document.getElementById('gameOverModal');
    if (gameOverModal) gameOverModal.style.display = 'none';
    
    game.reset();
    var config = {
        draggable: true,
        position: 'start',
        orientation: playerColor,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare,
        onSnapEnd: function() { board.position(game.fen()); }
    };
    
    if (document.getElementById('board')) {
        board = Chessboard('board', config);
    }
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') {
        window.setTimeout(makeAiMove, 500);
    }
}

function restartMatch() {
    var gameOverModal = document.getElementById('gameOverModal');
    if (gameOverModal) gameOverModal.style.display = 'none';
    startGame(playerColor);
}

function resetToMenu() {
    window.location.href = 'index.html';
}

function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    window.setTimeout(function() {
        var bestMove = calculateBestMove(currentAiDepth); 
        if (bestMove) {
            game.move(bestMove);
            board.position(game.fen());
            highlightCheckSquare();
            updateStatus();
            updateCapturedPieces();
            checkGameOver();
        }
    }, 200);
}

function calculateBestMove(depth) {
    var moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    var bestValue = -999999;
    var bestMove = moves[0];

    moves.sort(function(a, b) {
        return (b.captured ? 20 : 0) - (a.captured ? 20 : 0);
    });

    for (var i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        var value = minimax(depth - 1, -1000000, 1000000, false);
        game.undo();
        if (value > bestValue) {
            bestValue = value;
            bestMove = moves[i];
        }
    }
    return bestMove;
}

function minimax(depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.game_over()) {
        return evaluateBoard();
    }

    var moves = game.moves({ verbose: true });
    if (isMaximizing) {
        var maxEval = -999999;
        for (var i = 0; i < moves.length; i++) {
            game.move(moves[i]);
            var evaluation = minimax(depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        var minEval = 999999;
        for (var i = 0; i < moves.length; i++) {
            game.move(moves[i]);
            var evaluation = minimax(depth - 1, alpha, beta, true);
            game.undo();
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function evaluateBoard() {
    var totalEvaluation = 0;
    var boardState = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                totalEvaluation += getAdvancedPieceValue(piece, i, j);
            }
        }
    }
    return playerColor === 'white' ? -totalEvaluation : totalEvaluation;
}

function getAdvancedPieceValue(piece, r, c) {
    var weights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    var val = weights[piece.type];

    if ((r === 3 || r === 4) && (c === 3 || c === 4)) {
        val += 25;
    }

    if (piece.type === 'p') {
        val += (piece.color === 'w' ? (7 - r) : r) * 8;
    }

    return piece.color === 'w' ? val : -val;
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if (playerColor === 'white' && piece.search(/^b/) !== -1) return false;
    if (playerColor === 'black' && piece.search(/^w/) !== -1) return false;
}

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    removeHighlights();
    highlightCheckSquare();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();

    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
    if (game.turn() === aiTurnCheck && !game.game_over()) {
        makeAiMove();
    }
}

function highlightCheckSquare() {
    removeCheckHighlights();
    if (game.in_check()) {
        var boardState = game.board();
        var kingColor = game.turn();
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var piece = boardState[r][c];
                if (piece && piece.type === 'k' && piece.color === kingColor) {
                    var squareName = String.fromCharCode(97 + c) + (8 - r);
                    $('#board .square-' + squareName).css('background-color', 'rgba(231, 76, 60, 0.8)');
                }
            }
        }
    }
}

function removeCheckHighlights() {
    $('#board .square-55d63').css('background-color', '');
}

function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    for (var i = 0; i < moves.length; i++) {
        var targetSquare = moves[i].to;
        addMoveDot(targetSquare);
    }
}

function onMouseoutSquare(square, piece) {
    removeHighlights();
    highlightCheckSquare();
}

function addMoveDot(square) {
    var $sq = $('#board .square-' + square);
    if ($sq.length > 0 && $sq.find('.move-dot').length === 0) {
        $sq.append('<div class="move-dot"></div>');
    }
}

function removeHighlights() {
    $('.move-dot').remove();
    $('#board .square-55d63').css('background-color', '');
}

function updateCapturedPieces() {
    var history = game.history({ verbose: true });
    var whiteCaptured = [], blackCaptured = [];

    for (var i = 0; i < history.length; i++) {
        if (history[i].captured) {
            var p = history[i].captured.toUpperCase();
            var sym = { 'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚' }[p];
            if (history[i].color === 'w') blackCaptured.push(sym);
            else whiteCaptured.push(sym);
        }
    }

    if ($('#playerCaptured').length) {
        if (playerColor === 'white') {
            $('#playerCaptured').text(whiteCaptured.join(' '));
            $('#opponentCaptured').text(blackCaptured.join(' '));
        } else {
            $('#playerCaptured').text(blackCaptured.join(' '));
            $('#opponentCaptured').text(whiteCaptured.join(' '));
        }
    }
}

function checkGameOver() {
    if (game.game_over()) {
        var msg = game.in_checkmate() ? (game.turn() === playerColor[0] ? "هزمك الخصم! استمر في التدريب." : "أنت عبقري أسطوري! لقد حطمت دفاعات الخصم!") : "تعادل!";
        $('#winnerText').text(msg);
        var gameOverModal = document.getElementById('gameOverModal');
        if (gameOverModal) gameOverModal.style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    var txt = isThinking ? "الخصم يحلل عمق التحركات..." : (game.turn() === playerColor[0] ? "دورك الآن (قم بتحريك قطعتك)" : "دور الخصم...");
    $('#status').text(txt);
}

function selectLevel(lvl) {
    window.location.href = `game.html?level=${lvl}`;
}

function goBackToLevels() {
    window.location.href = 'index.html';
}

function openSettings() {
    var modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = 'flex';
}

function closeSettings() {
    var modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = 'none';
}

function toggleAllLevels() {
    alert("تم فتح جميع المستويات.");
    closeSettings();
}

function restartGame() {
    startGame(playerColor);
}

function toggleShowMoves() {
    showHints = !showHints;
    if (!showHints) {
        removeHighlights();
        alert("تم إيقاف عرض النقاط الخضراء للحركة.");
    } else {
        alert("تم تفعيل عرض النقاط الخضراء للحركة.");
    }
}

function updateEnemyInfo(lvl) {
    const characters = [
        { name: "هونامي إيتشينوسي", level: "Lv. 100", img: "images/1.jpg" },
        { name: "سوزوني هوريكيتا", level: "Lv. 300", img: "images/2.jpg" },
        { name: "كاكيرو ريون", level: "Lv. 600", img: "images/3.jpg" },
        { name: "ميابي ناجومو", level: "Lv. 1000", img: "images/4.jpg" },
        { name: "كوهي كاتسوراغي", level: "Lv. 1400", img: "images/5.jpg" },
        { name: "مانابو هوريكيتا", level: "Lv. 1800", img: "images/6.jpg" },
        { name: "إيكا أماساوا", level: "Lv. 2200", img: "images/7.jpg" },
        { name: "تاكويا ياغامي", level: "Lv. 2600", img: "images/8.jpg" },
        { name: "روين كوانجي", level: "Lv. 2900", img: "images/9.jpg" },
        { name: "أريسو ساكاياناغي", level: "Lv. 3200", img: "images/10.jpg" },
        { name: "كيوتكا أيانوكوجي", level: "Lv. ????", img: "images/ayanokoji.png" }
    ];

    let index = parseInt(lvl) - 1;
    if(index >= 0 && index < characters.length) {
        const nameEl = document.getElementById('enemy-name');
        const levelEl = document.getElementById('enemy-level');
        const imgEl = document.getElementById('enemy-img');
        if(nameEl) nameEl.innerText = characters[index].name;
        if(levelEl) levelEl.innerText = characters[index].level;
        if(imgEl) imgEl.src = characters[index].img;
    }
}
