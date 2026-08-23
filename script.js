var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;

function startGame(color) {
    playerColor = color;
    $('#startScreen').fadeOut(300);
    $('#gameOverModal').fadeOut(300);
    
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

// خوارزمية ذكية متقدمة جداً تجعل أيانوكوجي يلعب بمستوى خبير وصعب جداً
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    window.setTimeout(function() {
        var depth = 3; // عمق التفكير (مستوى قوي واحترافي)
        var bestMove = calculateBestMove(depth);
        
        if (bestMove) {
            game.move(bestMove);
            board.position(game.fen());
            updateStatus();
            updateCapturedPieces();
            checkGameOver();
        }
    }, 400);
}

function calculateBestMove(depth) {
    var moves = game.moves({ verbose: true });
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

    var moves = game.moves();
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
                totalEvaluation += getPieceWeight(piece);
            }
        }
    }
    return playerColor === 'white' ? -totalEvaluation : totalEvaluation;
}

function getPieceWeight(piece) {
    var weights = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
    var val = weights[piece.type] || 0;
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

    removeGreySquares();
    updateStatus();
    updateCapturedPieces();
    checkGameOver();

    var aiTurnCheck = (playerColor === 'white') ? 'b' : 'w';
    if (game.turn() === aiTurnCheck && !game.game_over()) {
        makeAiMove();
    }
}

function updateCapturedPieces() {
    var history = game.history({ verbose: true });
    var whiteCaptured = [];
    var blackCaptured = [];

    for (var i = 0; i < history.length; i++) {
        if (history[i].captured) {
            var piece = history[i].captured.toUpperCase();
            if (history[i].color === 'w') {
                blackCaptured.push(getSymbol(piece));
            } else {
                whiteCaptured.push(getSymbol(piece));
            }
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

function getSymbol(piece) {
    const symbols = { 'P': '♟', 'N': '♞', 'B': '♝', 'R': '♜', 'Q': '♛', 'K': '♚' };
    return symbols[piece] || '';
}

function checkGameOver() {
    if (game.game_over()) {
        var text = game.in_checkmate() ? (game.turn() === playerColor[0] ? "لقد هزمك أيانوكوجي! الفوز هو الأهم دائماً." : "أنت عبقري أسطوري! لقد هزمت أيانوكوجي!") : "تعادل!";
        $('#winnerText').text(text);
        $('#gameOverModal').fadeIn(300);
    }
}

function restartToMenu() {
    $('#gameOverModal').fadeOut(300);
    $('#startScreen').fadeIn(300);
}

function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    greySquare(square);
    for (var i = 0; i < moves.length; i++) greySquare(moves[i].to);
}

function onMouseoutSquare(square, piece) { removeGreySquares(); }

function greySquare(square) {
    var el = $('#board .square-' + square);
    el.css('background', el.hasClass('black-3c85d') ? '#696969' : '#a9a9a9');
}

function removeGreySquares() { $('#board .square-55d63').css('background', ''); }

// الأزرار والتفاعلات
$('#restartBtn').on('click', function() { restartToMenu(); });

$('#themeToggle').on('click', function() {
    $('body').toggleClass('dark-theme light-theme');
});

$('#fullscreenToggle').on('click', function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
});

$('#hintsToggle').on('click', function() {
    showHints = !showHints;
    $(this).css('opacity', showHints ? '1' : '0.4');
});

function updateStatus(isThinking = false) {
    var txt = isThinking ? "أيانوكوجي يحلل الحركات بعمق..." : (game.turn() === playerColor[0] ? "دورك الآن" : "أيانوكوجي يفكر...");
    $('#status').text(txt);
}
