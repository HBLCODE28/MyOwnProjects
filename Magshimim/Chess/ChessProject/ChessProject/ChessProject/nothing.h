#pragma once
#include "piece.h"
class nothing : public piece {
public:
	nothing(char letter, int location_x, int location_y);
	virtual bool checkIfMoveAllowed(const board& gameBoard, int new_location_x, int new_location_y) override;

	virtual bool checkIfRunsOver(int new_location_x, int new_location_y, const board& gameBoard);
	virtual char getLetter();
private:
	char _letter;
};