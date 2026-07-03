#include "Bishop.h"
Bishop::Bishop(char letter, int location_x, int location_y) : piece(letter, location_x, location_y)
{
    this->_letter = letter;
}

bool Bishop::checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y)
{
    if ((-(this->_location_x - new_location_x) == this->_location_y - new_location_y) || ((this->_location_x - new_location_x) == this->_location_y - new_location_y))
    {
        return true;
    }
    return false;
}
bool Bishop::checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard)
{
    if (this->_location_y < new_location_y && this->_location_x < new_location_x)
    {
        for (int i = this->_location_x + 1, j = this->_location_y + 1; i < new_location_x; i++, j++)
        {
            if (gameBoard.getPieceAt(i, j)->getLetter() != '#')
            {
                return true;
            }
        }
    }
    else if (this->_location_y < new_location_y && this->_location_x > new_location_x)
    {
        for (int i = this->_location_x - 1, j = this->_location_y + 1; i > new_location_x; i--, j++)
        {

            if (gameBoard.getPieceAt(i, j)->getLetter() != '#')
            {
                return true;
            }
        }
    }
    else if (this->_location_y > new_location_y && this->_location_x > new_location_x)
    {
        for (int i = this->_location_x - 1, j = this->_location_y - 1; i > new_location_x; i--, j--)
        {
            if (gameBoard.getPieceAt(i, j)->getLetter() != '#')
            {
                return true;
            }
        }
    }
    else if (this->_location_y > new_location_y && this->_location_x < new_location_x)
    {
        for (int i = this->_location_x + 1, j = this->_location_y - 1; i < new_location_x; i++)
        {
            if (gameBoard.getPieceAt(i, j)->getLetter() != '#')
            {
                return true;
            }
        }
    }
    return false;
}
char Bishop::getLetter()
{
    return this->_letter;
}

