<<<<<<< HEAD
#include "board.h"
#include "piece.h"
#include "rook.h"
#include "king.h"
#include "gameManager.h"
=======
>>>>>>> 3418712832e991a07872802b7758d89bb1010e5a
#include <iostream>
#include "board.h"
#include "pawn.h"
#include "rook.h"
#include "knight.h"
#include "bishop.h"
#include "queen.h"
#include "king.h"

void printTestResult(const std::string& pieceName, const std::string& expected, const std::string& actual) {
    std::cout << "\n" << pieceName << "\n";
    std::cout << "------------------------\n";
    std::cout << "Expected: " << expected << "\n";
    std::cout << "Actual:   " << actual << "\n";
}

<<<<<<< HEAD
void testBoardInitialization() {
    std::string initialBoard = "RNBQKBNRPPPPPPPP################################pppppppprnbqkbnr";
    board gameBoard(initialBoard);
    
    setConsoleColor(14); // Yellow 
    std::cout << "Initial Board State:" << std::endl;
    setConsoleColor(7);  
    gameBoard.printBoard();

    assert(gameBoard.getPieceAt(0, 0) != nullptr);
    assert(gameBoard.getPieceAt(0, 0)->getLetter() == 'R');
    assert(gameBoard.getPieceColor(0, 0) == 'W');
    assert(gameBoard.getPieceColor(7, 7) == 'B');
    assert(gameBoard.getPieceAt(4, 4) == nullptr);
    setConsoleColor(10); // Green 
    std::cout << "Board initialization test passed!" << std::endl;
    setConsoleColor(7);  
}
=======
void testChessProject() {
    std::string initialBoard =
        "rnbqkbnr"
        "pppppppp"
        "########"
        "########"
        "########"
        "########"
        "PPPPPPPP"
        "RNBQKBNR";

    board chessBoard(initialBoard);

    std::cout << "Initial Chess Board:\n";
    chessBoard.printBoard();

    std::cout << "\nTesting piece movements:\n";
>>>>>>> 3418712832e991a07872802b7758d89bb1010e5a

    piece* pawn_from_board = chessBoard.getPieceAt(1, 0);
    if (pawn_from_board) {
        Pawn pawn(pawn_from_board->getLetter(), 1, 0);
        if (pawn.checkIfMoveAllowed(chessBoard, 3, 0)) {
            printTestResult("Pawn", "Move allowed to (3, 0)", "Move allowed");
        }
        else {
            printTestResult("Pawn", "Move allowed to (3, 0)", "Move not allowed");
        }
    }

    piece* rook_from_board = chessBoard.getPieceAt(7, 0);
    if (rook_from_board) {
        Rook rook(rook_from_board->getLetter(), 7, 0);
        if (rook.checkIfMoveAllowed(chessBoard, 5, 0)) {
            printTestResult("Rook", "Move not allowed to (5, 0) (there is a piece blocking) ", "Move allowed");
        }
        else {
            printTestResult("Rook", "Move not allowed to (5, 0) (there is a piece blocking)  ", "Move not allowed");
        }
    }

    piece* knight_from_board = chessBoard.getPieceAt(7, 1);
    if (knight_from_board) {
        Knight knight(knight_from_board->getLetter(), 7, 1);
        if (knight.checkIfMoveAllowed(chessBoard, 5, 2)) {
            printTestResult("Knight", "Move allowed to (5, 2)", "Move allowed");
        }
        else {
            printTestResult("Knight", "Move allowed to (5, 2)", "Move not allowed");
        }
    }

    piece* bishop_from_board = chessBoard.getPieceAt(7, 2);
    if (bishop_from_board) {
        Bishop bishop(bishop_from_board->getLetter(), 7, 2);
        if (bishop.checkIfMoveAllowed(5, 0)) {
            printTestResult("Bishop", "Move not allowed to (5, 0)", "Move allowed");
        }
        else {
            printTestResult("Bishop", "Move not allowed to (5, 0)", "Move not allowed");
        }
    }

    piece* queen_from_board = chessBoard.getPieceAt(7, 3);
    if (queen_from_board) {
        Queen queen(queen_from_board->getLetter(), 7, 3);
        if (queen.checkIfMoveAllowed( 5, 3)) {
            printTestResult("Queen", "Move not allowed to (5, 3)", "Move allowed");
        }
        else {
            printTestResult("Queen", "Move not allowed to (5, 3)", "Move not allowed");
        }
    }

<<<<<<< HEAD
void testMoveValidation() {
    std::string initialBoard = "RNBQKBNRPPPPPPPP################################pppppppprnbqkbnr";
    gameManager* newGameManager = new gameManager(initialBoard);
    newGameManager->removePiece(0, 0);
    newGameManager->printBoard();
    board gameBoard(initialBoard);
    piece* rook = gameBoard.getPieceAt(0, 0);


    assert(rook->checkIfMoveAllowed(gameBoard, nullptr, 0, 5) == false);
    assert(rook->checkIfMoveAllowed(gameBoard, rook, 0, 1) == true);

    piece* king = gameBoard.getPieceAt(0, 4);
    assert(king->checkIfMoveAllowed(gameBoard, king, 1, 4) == true);
    assert(king->checkIfMoveAllowed(gameBoard, king, 2, 4) == false);
    assert(king->checkIfMoveAllowed(gameBoard, king, 1, 3) == true);

    setConsoleColor(10); // Green 
    std::cout << "Move validation test passed!" << std::endl;
    setConsoleColor(7);  
}

void testBoundaryConditions() {
    Rook* rook = new Rook('R', 0, 0);
    assert(rook->checkIfInBorder() == true);
    Rook* outOfBoundsRook = new Rook('R', -1, 9);
    assert(outOfBoundsRook->checkIfInBorder() == false);

    setConsoleColor(10); // Green 
    std::cout << "Boundary conditions test passed!" << std::endl;
    setConsoleColor(7); 
}

int main() {
    try {
        setConsoleColor(11); // Light cyan
        std::cout << "Running tests..." << std::endl;
        setConsoleColor(7); 

        testBoardInitialization();
        testPieceLogic();
        testMoveValidation();
        testBoundaryConditions();
    }
    catch (const std::exception& e) {
        setConsoleColor(12); // Red 
        std::cerr << "Test failed: " << e.what() << std::endl;
        setConsoleColor(7);  
        return 1;
    }

    setConsoleColor(10); // Green
    std::cout << "All tests passed!" << std::endl;
    setConsoleColor(7); 

=======
    piece* king_from_board = chessBoard.getPieceAt(7, 4);
    if (king_from_board) {
        King king(king_from_board->getLetter(), 7, 4);
        if (king.checkIfMoveAllowed(chessBoard, 6, 5)) {
            printTestResult("King", "Move not allowed to (6, 5)", "Move allowed");
        }
        else {
            printTestResult("King", "Move not allowed to (6, 5)", "Move not allowed");
        }
    }
}

int main() {
    testChessProject();
>>>>>>> 3418712832e991a07872802b7758d89bb1010e5a
    return 0;
}
