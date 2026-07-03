#pragma once
#include "piece.h"
class Knight : public piece{
public:
	Knight(char letter, int location_x, int location_y);
	
	virtual bool checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y);
	virtual char getLetter();
	virtual bool checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard);

private:
	char _letter;
};