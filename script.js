var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;

window.addEventListener('DOMContentLoaded', (event) => {
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

// ذكاء اصطناعي عميق جداً ومستوى أسطوري (Minimax Algorithm بعمق 3 خطوات)
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    window.setTimeout(function() {
        var bestMove = calculateBestMove(3);
        if (bestMove) {
            game.move(bestMove);
            board.position(game.fen());
            highlightCheckSquare();
            updateStatus();
            updateCapturedPieces();
            checkGameOver();
        }
    }, 400);
}

function calculateBestMove(depth) {
    var moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    var bestValue = -99999;
    var bestMove = moves[0];

    for (var i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        var value = minimax(depth - 1, -100000, 100000, false);
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
        var maxEval = -99999;
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
        var minEval = 99999;
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
    var boardState = game.board();
    var totalEvaluation = 0;
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                var weights = { p: 10, n: 35, b: 35, r: 55, q: 100, k: 1000 };
                var val = weights[piece.type] || 0;
                totalEvaluation += (piece.color === 'w' ? val : -val);
            }
        }
    }
    return playerColor === 'white' ? -totalEvaluation : totalEvaluation;
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
                    $('#board .square-' + squareName).addClass('highlight-check');
                }
            }
        }
    }
}

function removeCheckHighlights() {
    $('#board .square-55d63').removeClass('highlight-check');
}

// عرض الحركات مع ألوان دقيقة: أزرق/بنفسجي للأكل، أخضر للتبييت، ورمادي للحركات العادية
function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    greySquare(square, 'highlight-move');
    for (var i = 0; i < moves.length; i++) {
        var targetSquare = moves[i].to;
        var cssClass = 'highlight-move';

        // إذا كانت الحركة أكل قطعة
        if (moves[i].captured) {
            cssClass = 'highlight-capture'; // أزرق / بنفسجي
        }
        // إذا كانت حركة استبدال/تبييت (Castling)
        else if (moves[i].san === 'O-O' || moves[i].san === 'O-O-O' || (piece.type === 'k' && Math.abs(square.charCodeAt(0) - targetSquare.charCodeAt(0)) > 1)) {
            cssClass = 'highlight-castle'; // أخضر
        }

        greySquare(targetSquare, cssClass);
    }
}

function onMouseoutSquare(square, piece) {
    removeHighlights();
    highlightCheckSquare();
}

function greySquare(square, className) {
    $('#board .square-' + square).addClass(className);
}

function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-move highlight-capture highlight-castle');
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
        var msg = game.in_checkmate() ? (game.turn() === playerColor[0] ? "هزمك أيانوكوجي! الفوز هو المعيار الوحيد." : "أنت عبقري أسطوري! لقد هزمت أيانوكوجي!") : "تعادل!";
        $('#winnerText').text(msg);
        document.getElementById('gameOverModal').style.display = 'flex';
    }
}

function updateStatus(isThinking = false) {
    var txt = isThinking ? "أيانوكوجي يحلل الأنماط بدقة..." : (game.turn() === playerColor[0] ? "دورك الآن (قم بتحريك قطعتك)" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
