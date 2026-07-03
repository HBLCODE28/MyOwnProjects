#pragma once
#include "iostream"
#include "board.h"

class board;
//we need to use the Applicative protocol [It doesn't matter right now.]
//After an action has been performed on the Frontend, and after we have made the requested move in the Backend, a two - character string must be returned to the Frontend.
//The first character represents a code, and the second character is NULL
//Pre - agreed codes :
//
//0 – valid move
//1 – valid move, a move was made that caused check on the opponent
//2 – invalid move, there is no piece of the current player on the source square
//3 – invalid move, there is a piece of the current player on the target square
//4 – invalid move, the move will cause check on the current player
//5 – invalid move, indices of the squares are invalid *
//6 – invalid move, illegal move of a piece
//7 – invalid move, source square and target square are the same
//8 – valid move, check was made!

class piece 
{
	public:

		piece(char piece, int location_y, int location_x);

		virtual bool checkIfInBorder();
		virtual bool checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y) = 0;
		virtual bool checkIfSamePlace(int new_loction_x, int new_loction_y);
		virtual bool checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard) = 0;
		virtual bool checkIfDestSameColor(board& _board, int new_loction_x, int new_loction_y);
		bool checkIfChecksKing(const board& gameBoard, int player);
		virtual char getLetter() = 0;
		virtual void setLocation(int location_x, int location);
	protected:
		int _isLegal;
		char piece_char;
		int _location_x;
		int _location_y;
};

