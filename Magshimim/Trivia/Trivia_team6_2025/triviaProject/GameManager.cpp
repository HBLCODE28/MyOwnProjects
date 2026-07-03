#include "GameManager.h"
GameManager::GameManager(IDatabase* db)
{
	this->_db = db;
}
GameManager::~GameManager()
{
}
Game& GameManager::createGame( Room& rm) 
{
	return this->createGame(rm.getRoomNumber(),rm.getNumOfQuestions());
}
Game& GameManager::createGame(unsigned int gameId,unsigned int numberOfQuestions) 
{
	Game gm(this->_db, gameId,numberOfQuestions);
	std::lock_guard<std::shared_mutex> gameLock(this->_gameMtx);
	this->_games.push_back(gm);
	return this->_games.at(this->_games.size() - 1);
}
void GameManager::deleteGame(Room& rm) 
{
	this->deleteGame(rm.getRoomNumber());
}
void GameManager::deleteGame(const unsigned int gameId)
{
	std::lock_guard<std::shared_mutex> deleteGameLock(this->_gameMtx);
	for (auto it = this->_games.begin(); it != this->_games.end(); it++) 
	{
		if (it->getGameId() == gameId)
		{
			this->_games.erase(it);
			return;
		}
	}
}
Game& GameManager::getGame(unsigned int gameId) 
{
	std::shared_lock<std::shared_mutex> gameLock(this->_gameMtx);
	for (auto it = this->_games.begin(); it != this->_games.end(); it++) {
		if (it->getGameId() == gameId) {
			return *it;
		}
	}
	throw std::exception("invalid game id");
}