#include "pawn.h"

Pawn::Pawn(char letter, int location_x, int location_y) : piece(letter, location_x, location_y )
{
	this->_letter = letter;
}



bool Pawn::checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y)
{
    char pieceColor = gameBoard.getPieceColor(this->_location_x, this->_location_y);
    bool isPawnStartW = false;
    bool isPawnStartB = false;
    if (this->_location_x != new_location_x && gameBoard.getPieceAt(new_location_x, new_location_y)->getLetter() == '#')
    {
        return false;
    }
    if(gameBoard.getPieceAt(new_location_x, new_location_y)->getLetter() != '#')
    {
        if (this->_location_y == new_location_y + 1 && pieceColor == 'W' && (this->_location_x == new_location_x-1 || this->_location_x == new_location_x + 1)) {
            return true;
        }
        if (this->_location_y == new_location_y - 1 && pieceColor == 'B' && (this->_location_x == new_location_x - 1 || this->_location_x == new_location_x + 1)) {
            return true;
        }
    }
    if (pieceColor == 'W' && this->_location_y == 6)
    {
        isPawnStartW = true;
    }
    if (pieceColor == 'B' && this->_location_y == 1)
    {
        isPawnStartB = true;
    }
    if (this->_location_y == new_location_y+2 && isPawnStartW)
    {
        return true;
    }
    if (this->_location_y == new_location_y - 2 && isPawnStartB)
    {
        return true;
    }

    if (this->_location_y == new_location_y + 1 && pieceColor == 'W') {
        return true;
    }
    if (this->_location_y == new_location_y -1 && pieceColor == 'B') {
        return true;
    }
    return false; 
}
char Pawn::getLetter()
{
	return this->_letter;
}
bool Pawn::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
    return false;
}