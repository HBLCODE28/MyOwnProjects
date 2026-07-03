#pragma once
#include "Question.h"
#include "LoggedUser.h"
#include <map>
#include <vector>
#include "IDatabase.h"
#include <shared_mutex>
#include "Responses.h"
typedef struct GameData
{
	Question _currentQuestion;
	unsigned int _correctAnswerCount;
	unsigned int _wrongAnswerCount;
	unsigned int _averageAnswerTime;
	struct GameData* operator=(struct GameData* data) 
	{
		this->_averageAnswerTime = data->_averageAnswerTime;
		this->_wrongAnswerCount = data->_wrongAnswerCount;
		this->_correctAnswerCount = data->_correctAnswerCount;
		this->_currentQuestion = data->_currentQuestion;
		return this;
	}
}GameData;
class Game
{
private:
	IDatabase* _db;
	unsigned int _gameId;
	std::shared_mutex _usersMtx;
	std::vector<Question> _questions;
	std::map<LoggedUser, struct GameData> _players;
public:
	Game(IDatabase* _db,unsigned int gameId,unsigned int numberOfQuestions);
	Game(const Game& otherGame);
	~Game();
	unsigned int getGameId()const;
	void removeUser(const LoggedUser& user);
	void addUser(const LoggedUser& user);
	Question getQuestionForUser(const LoggedUser& user);
	bool submitAnswer(const LoggedUser& user,const unsigned int anserId,unsigned int asnwerTimeDiff);
	std::vector<struct PlayerResults> getGameResults();
	Game& operator=(const Game& otherGame);
	Game& operator=(Game&& other);
};

