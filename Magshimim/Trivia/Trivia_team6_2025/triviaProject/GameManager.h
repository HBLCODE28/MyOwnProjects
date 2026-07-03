#pragma once
#include "IDatabase.h"
#include "Game.h"
#include <vector>
#include "Room.h"
#include <shared_mutex>
class GameManager
{
public:
	GameManager(IDatabase* db);
	~GameManager();
	Game& createGame( Room& rm);
	Game& createGame(unsigned int gameId,unsigned int numberOfQuestions);
	Game& getGame(unsigned int gameId);
	void deleteGame( Room& rm);
	void deleteGame(const unsigned int gameId);
private:
	IDatabase* _db;
	std::vector<Game> _games;
	std::shared_mutex _gameMtx;
};

