var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;
var stockfish = null;

window.addEventListener('DOMContentLoaded', (event) => {
    // تهيئة محرك Stockfish عبر الرابط المباشر
    try {
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
        stockfish.onmessage = function(event) {
            var line = event.data;
            if (line.startsWith('bestmove')) {
                var moveStr = line.split(' ')[1];
                if (moveStr) {
                    var move = game.move({
                        from: moveStr.substring(0, 2),
                        to: moveStr.substring(2, 4),
                        promotion: moveStr.substring(4, 5) || 'q'
                    });
                    if (move) {
                        board.position(game.fen());
                        highlightCheckSquare();
                        updateStatus();
                        updateCapturedPieces();
                        checkGameOver();
                    }
                }
            }
        };
        stockfish.postMessage('uci');
    } catch (e) {
        console.error("خطأ في تشغيل Stockfish Worker:", e);
    }

    document.getElementById('themeToggle').addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
    });

    document.getElementById('fullscreenToggle').addEventListener('click', function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });

    document.getElementById('hintsToggle').addEventListener('click', function() {
        showHints = !showHints;
        this.style.opacity = showHints ? '1' : '0.4';
    });
});

function startGame(color) {
    playerColor = color;
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverModal').style.display = 'none';
    
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
    
    board = Chessboard('board', config);
    updateStatus();
    updateCapturedPieces();

    if (playerColor === 'black') {
        window.setTimeout(makeAiMove, 500);
    }
}

function restartMatch() {
    document.getElementById('gameOverModal').style.display = 'none';
    startGame(playerColor);
}

function resetToMenu() {
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
}

// طلب الحركة من محرك Stockfish الخارق
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    if (stockfish) {
        stockfish.postMessage('position fen ' + game.fen());
        // تحديد قوة التفكير (يمكنك تعديل عمق البحث 'go depth 12' لزيادة الصعوبة)
        stockfish.postMessage('go depth 12');
    }
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

// تلوين مربعات الحركات: رمادي عادي، بنفسجي للأكل، أخضر للتبييت
function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    colorSquare(square, 'rgba(100, 100, 100, 0.5)');

    for (var i = 0; i < moves.length; i++) {
        var targetSquare = moves[i].to;
        var color = 'rgba(100, 100, 100, 0.5)';

        if (moves[i].captured) {
            color = 'rgba(142, 68, 173, 0.85)'; // بنفسجي للأكل (الصيد)
        } else if (moves[i].san === 'O-O' || moves[i].san === 'O-O-O' || (piece.type === 'k' && Math.abs(square.charCodeAt(0) - targetSquare.charCodeAt(0)) > 1)) {
            color = 'rgba(46, 204, 113, 0.85)'; // أخضر للتبييت
        }

        colorSquare(targetSquare, color);
    }
}

function onMouseoutSquare(square, piece) {
    removeHighlights();
    highlightCheckSquare();
}

function colorSquare(square, color) {
    $('#board .square-' + square).css('background-color', color);
}

function removeHighlights() {
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

    if (playerColor === 'white') {
        $('#playerCaptured').text(whiteCaptured.join(' '));
        $('#opponentCaptured').text(blackCaptured.join(' '));
    } else {
        $('#playerCaptured').text(blackCaptured.join(' '));
        $('#opponentCaptured').text(whiteCaptured.join(' '));
    }
}

function checkGameOver() {
    if (game.game_over()) {
        var msg = game.in_checkmate() ? (game.turn() === playerColor[0] ? "هزمك أيانوكوجي! الفوز هو المعيار الوحيد." : "أنت عبقري أسطوري! لقد هزمت Stockfish وأيانوكوجي معا!") : "تعادل!";
        $('#winnerText').text(msg);
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    var txt = isThinking ? "Stockfish (أيانوكوجي) يحسب أعماق استراتيجية..." : (game.turn() === playerColor[0] ? "دورك الآن (قم بتحريك قطعتك)" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
