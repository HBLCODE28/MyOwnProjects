#pragma once
#include "piece.h"
class King : public piece{
public:
	King(char letter, int location_x, int location_y);
	virtual bool checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard);
	virtual bool checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y) override;
	virtual char getLetter();

private:
	char _letter;
};

