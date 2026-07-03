#include "piece.h"
#define WHITE_PAWN_Y 1
#define BLACK_PAWN_Y 6
piece::piece(char piece, int location_y, int location_x)
{
	this->piece_char = piece;
	this->_isLegal = true;
	this->_location_x = location_x;
	this-> _location_y = location_y;
}
// check for any piece 
bool piece::checkIfSamePlace(int new_loction_x, int new_loction_y)
{
	if ((_location_x == new_loction_x) && (_location_y == new_loction_y))
	{
		return true;
	}
	return false;
}

bool piece::checkIfDestSameColor(board& _board, int new_loction_x, int new_loction_y)
{
	
	if (_board.getPieceColor(new_loction_x, new_loction_y) == _board.getPieceColor(this->_location_x, this->_location_y))
	{
		return true;
	}
	return false; 
}


bool piece::checkIfInBorder()
{
	if (this->_location_x < 0 || this->_location_x >= BOARD_LIMIT || this->_location_y < 0 || this->_location_y >= BOARD_LIMIT)
	{
		return false;
	}
	return true;
}
bool piece::checkIfChecksKing(const board& gameBoard, int player)
{
	int king_Position_x = 0;
	int king_Position_y = 0;
	char opponentKing = ' ';
	if (player == 1)
	{
		opponentKing = black_king;
	}
	else
	{
		opponentKing = WHITE_KING;
	}
	for (int i = 0; i < BOARD_LIMIT; i++)
	{
		for (int j = 0; j < BOARD_LIMIT; j++)
		{
			if (gameBoard.getPieceAt(j, i)->getLetter() == opponentKing)
			{
				king_Position_x = j;
				king_Position_y = i;
			}
		}
	}

	if (player == 2)
	{
		for (int i = 0; i < BOARD_LIMIT; i++)
		{
			for (int j = 0; j < BOARD_LIMIT; j++)
			{
				if (gameBoard.getPieceAt(j, i)->checkIfMoveAllowed(gameBoard, king_Position_x, king_Position_y) && std::isupper(gameBoard.getPieceAt(j, i)->getLetter()) && gameBoard.getPieceAt(j, i)->checkIfRunsOver(king_Position_x, king_Position_y, gameBoard) == false)
				{
					return true;
				}
			}
		}
	}	
	if (player == 1)
	{
		for (int i = 0; i < BOARD_LIMIT; i++)
		{
			for (int j = 0; j < BOARD_LIMIT; j++)
			{
				if (gameBoard.getPieceAt(j, i)->checkIfMoveAllowed(gameBoard, king_Position_x, king_Position_y) && !std::isupper(gameBoard.getPieceAt(j, i)->getLetter()) && gameBoard.getPieceAt(j, i)->checkIfRunsOver(king_Position_x, king_Position_y, gameBoard) == false)
				{
					return true;
				}
			}
		}
	}
	return false;
}
void piece::setLocation(int location_x, int location_y)
{
	this->_location_x = location_x;
	this->_location_y = location_y;
}

