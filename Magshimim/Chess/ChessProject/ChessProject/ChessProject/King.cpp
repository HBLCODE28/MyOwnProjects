#include "king.h"
#include <cmath> 



King::King(char letter, int location_x, int location_y) : piece(letter, location_x, location_y)
{
    this->_letter = letter;
}

/*
bool King::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
    piece* targetPiece = gameBoard.getPieceAt(new_location_x, new_location_y);
    if (targetPiece && gameBoard.getPieceColor(new_location_x, new_location_y))
    {
        return true;
    }
    return false;
}*/

bool King::checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y)
{
    if (abs(new_location_x - _location_x) <= 1 && abs(new_location_y - _location_y) <= 1) {
        {
            return true;
        }
    }
    return false;
}

char King::getLetter()
{
    return this->_letter;
}
bool King::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
    return false;
}