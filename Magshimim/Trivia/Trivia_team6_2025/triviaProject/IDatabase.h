#pragma once
#include <string>
#include <vector>
#include "Question.h"
typedef struct Player 
{
	std::string username;
	unsigned int points;
}Player;
class IDatabase 
{
public:
	IDatabase();
	virtual ~IDatabase();
	virtual bool open() = 0;
	virtual bool close() = 0;
	virtual bool doesUserExist(const std::string& user)=0;
	virtual bool doesPasswordMatch(const std::string& user, const std::string& password)=0;
	virtual bool addNewUser(const std::string& user, const std::string& password, const std::string& foo)=0;
	virtual float getPlayerAverageAnswerTime(const std::string& username) = 0;
	virtual int getNumOfCorrectAnswers(const std::string& username) = 0;
	virtual int getNumOfTotalAnswers(const std::string& username) = 0;
	virtual int getNumOfPlayerGames(const std::string& username) = 0;
	virtual bool insertStatistics(const std::string& username, const int gameId,const int questionsAnswered,const int correctlyAnsweredQuestions , const float avgTimeToAnswer)=0;
	virtual bool insertQuestion(const std::string& question, const std::string& right_answer,const std::string& wrong_answer) = 0;
	virtual bool insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1,const std::string& wrong_answer2) = 0;
	virtual bool insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1,const std::string&  wrong_answer2,const std::string& wrong_answer3) = 0;
	virtual void insertTenRandomQuestions() = 0;
	virtual int getPlayerPoints(const std::string& username)=0;
	virtual struct Player getPlayerStats(const unsigned int playerOffset)=0;
	virtual int getNumberOfUsers()=0;
	virtual std::vector<Question> getQuestionsForGame(const unsigned int roomQuestions)=0;
	virtual int getNumberOfQuestions()=0;
	virtual int getLastGamePlayed() = 0;
	virtual int updatePlayerStats(const std::string& username, const int gamdid, const int questionsAnswered, const int correctlyAnsweredQuestions, const unsigned int avgTimeToAnswer)=0;
private:
};