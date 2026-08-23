var board = null;
var game = new Chess();
var playerColor = 'white';
var showHints = true;

$(document).ready(function() {
    // تفعيل أزرار البداية
    $('#chooseWhite').on('click', function() { startGame('white'); });
    $('#chooseBlack').on('click', function() { startGame('black'); });
    $('#restartBtn, #restartModalBtn').on('click', function() {
        $('#gameOverModal').hide();
        $('#startScreen').css('display', 'flex');
    });

    // الأزرار الجانبية
    $('#themeToggle').on('click', function() { $('body').toggleClass('dark-theme light-theme'); });
    $('#fullscreenToggle').on('click', function() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    });
    $('#hintsToggle').on('click', function() {
        showHints = !showHints;
        $(this).css('opacity', showHints ? '1' : '0.4');
    });
});

function startGame(color) {
    playerColor = color;
    $('#startScreen').hide();
    $('#gameOverModal').hide();
    
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

// ذكاء اصطناعي قوي
function makeAiMove() {
    if (game.game_over()) return;
    updateStatus(true);

    window.setTimeout(function() {
        var moves = game.moves({ verbose: true });
        if (moves.length === 0) return;

        var bestMove = moves[0];
        var bestValue = -99999;

        for (var i = 0; i < moves.length; i++) {
            game.move(moves[i]);
            var value = evaluateBoard();
            game.undo();
            if (value > bestValue) {
                bestValue = value;
                bestMove = moves[i];
            }
        }

        game.move(bestMove);
        board.position(game.fen());
        highlightCheckSquare();
        updateStatus();
        updateCapturedPieces();
        checkGameOver();
    }, 500);
}

function evaluateBoard() {
    var boardState = game.board();
    var totalEvaluation = 0;
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                var weights = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
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

// ميزة تلوين الملك باللون الأحمر عند الكش (Check)
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

// ميزة إظهار المربعات المتاحة للحركات عند الوقوف على القطعة
function onMouseoverSquare(square, piece) {
    if (!showHints) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    greySquare(square);
    for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to);
    }
}

function onMouseoutSquare(square, piece) {
    removeHighlights();
    highlightCheckSquare();
}

function greySquare(square) {
    var el = $('#board .square-' + square);
    var bg = el.hasClass('black-3c85d') ? '#696969' : '#a9a9a9';
    el.css('background', bg);
}

function removeHighlights() {
    $('#board .square-55d63').css('background', '');
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
        var msg = game.in_checkmate() ? (game.turn() === playerColor[0] ? "هزمك أيانوكوجي! الفوز هو الأهم." : "أنت أسطورة! لقد هزمت أيانوكوجي!") : "تعادل!";
        $('#winnerText').text(msg);
        $('#gameOverModal').css('display', 'flex');
    }
}

function updateStatus(isThinking = false) {
    var txt = isThinking ? "أيانوكوجي يحلل..." : (game.turn() === playerColor[0] ? "دورك الآن (قم بتحريك قطعتك)" : "دور أيانوكوجي...");
    $('#status').text(txt);
}
