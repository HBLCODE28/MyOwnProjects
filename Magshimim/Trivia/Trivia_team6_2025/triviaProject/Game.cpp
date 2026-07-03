#include "Game.h"
#define QUESTIONS_IN_GAME 10
Game::Game(IDatabase* db, unsigned int gameId,unsigned int numberOfQuestions)
{
	this->_gameId = gameId;
	this->_db = db;
	this->_questions = this->_db->getQuestionsForGame(numberOfQuestions);
}
Game::Game(const Game& otherGame)
{
	this->_db = otherGame._db;
	this->_gameId = otherGame._gameId;
	this->_players = otherGame._players;
	this->_questions = otherGame._questions;
}
Game& Game::operator=(Game&& other) 
{
	this->_db = other._db;
	this->_gameId = other._gameId;
	this->_questions = other._questions;
	this->_players = other._players;
	return *this;
}
Game::~Game() 
{
	for (auto it = this->_players.begin(); it != this->_players.end(); it++)
	{
		this->removeUser(it->first);
	}
}
void Game::addUser(const LoggedUser& user)
{
	struct GameData dt;
	dt._averageAnswerTime = 0;
	dt._correctAnswerCount = 0;
	dt._wrongAnswerCount = 0;
	dt._currentQuestion = this->_questions[0];
	std::lock_guard<std::shared_mutex> playerLock(this->_usersMtx);
	this->_players.insert({user,dt});
}
Question Game::getQuestionForUser(const LoggedUser& user) 
{
	std::shared_lock<std::shared_mutex> questionLock(this->_usersMtx);
	auto stats =this->_players[user];
	questionLock.unlock();
	if (stats._correctAnswerCount + stats._wrongAnswerCount >= this->_questions.size())
	{
		throw std::exception(__FUNCTION__" - user asked too much questions");
	}
	return this->_questions[stats._correctAnswerCount + stats._wrongAnswerCount];
}
bool Game::submitAnswer(const LoggedUser& user,const unsigned int answerId,unsigned int answerTimeDiff) 
{
	std::shared_lock<std::shared_mutex> questionLock(this->_usersMtx);
	auto stats = this->_players[user];
	auto userMemStat = this->_players.find(user);
	auto userEnd = this->_players.end();
	questionLock.unlock();
	int numberOfQuestions = stats._correctAnswerCount + stats._wrongAnswerCount;
	auto qs = this->_questions[numberOfQuestions];
	bool answeredRight = false;
	if (qs.getCorrectAnswerId() == answerId)
	{
		if (userMemStat != userEnd)
		{
			answeredRight = true;
			userMemStat->second._correctAnswerCount += 1;
		}
	}
	else 
	{
		if (userMemStat != userEnd)
		{
			userMemStat->second._wrongAnswerCount += 1;
		}
	}
	userMemStat->second._averageAnswerTime = (int)((userMemStat->second._averageAnswerTime * (numberOfQuestions))+answerTimeDiff) / (numberOfQuestions + 1);
	if (userMemStat->second._correctAnswerCount + userMemStat->second._wrongAnswerCount == 1) 
	{
		this->_db->insertStatistics(user.getUsername(), this->_gameId, numberOfQuestions + 1, userMemStat->second._correctAnswerCount, userMemStat->second._averageAnswerTime);
	}
	else
	{
		this->_db->updatePlayerStats(user.getUsername(), this->_gameId, numberOfQuestions + 1, userMemStat->second._correctAnswerCount, userMemStat->second._averageAnswerTime);
	}
	return answeredRight;
}
void Game::removeUser(const LoggedUser& user) 
{
	std::shared_lock<std::shared_mutex> playersMutex(this->_usersMtx);
	auto userStats = this->_players[user];
	playersMutex.unlock();
	
	this->_db->updatePlayerStats(user.getUsername(), this->_gameId, userStats._correctAnswerCount+userStats._wrongAnswerCount,userStats._correctAnswerCount,userStats._averageAnswerTime);
	std::lock_guard<std::shared_mutex> removeLock(this->_usersMtx);
	this->_players.erase(user);
}

Game& Game::operator=(const Game& otherGame) 
{
	this->_gameId = otherGame._gameId;
	this->_questions = otherGame._questions;
	this->_players = otherGame._players;	
	return *this;
}
unsigned int Game::getGameId()const 
{
	return this->_gameId;
}
std::vector<struct PlayerResults > Game::getGameResults()
{
	std::vector<struct PlayerResults> results;
	struct PlayerResults res;
	std::shared_lock <std::shared_mutex> usersLock(this->_usersMtx);
	for (auto it = this->_players.begin(); it != this->_players.end(); it++)
	{
		res.username = it->first.getUsername();
		res.correctAnswerCount = it->second._correctAnswerCount;
		res.averageAnswerTime = it->second._averageAnswerTime;
		res.wrongAnswerCount = it->second._wrongAnswerCount;
		results.push_back(res);
	}
	usersLock.unlock();
	return results;
}