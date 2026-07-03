#pragma once
#include "IDatabase.h"
#include "sqlite3.h"
#include <string>
#include <io.h>
#include <shared_mutex>
#include <iostream>
#include <stdio.h>
#include <stdlib.h>
#include "Question.h"
#include <vector>
#define NUM_OF_TABLES 4
class SqliteDatabase:public IDatabase
{
public:
	SqliteDatabase(const std::string databaseName);
	virtual ~SqliteDatabase();
	virtual bool open() override;
	virtual bool close() override;
	virtual bool doesUserExist(const std::string& user)override;
	virtual bool doesPasswordMatch(const std::string& user, const std::string& password)override;
	virtual bool addNewUser(const std::string& user, const std::string& password, const std::string& email)override;
	virtual float getPlayerAverageAnswerTime(const std::string& username) override;
	virtual int getNumOfCorrectAnswers(const std::string& username) override;
	virtual int getNumOfTotalAnswers(const std::string& username) override;
	virtual int getNumOfPlayerGames(const std::string& username) override;
	virtual bool insertStatistics(const std::string& username, const int gameId, const int questionsAnswered, const int correctlyAnsweredQuestions, const float avgTimeToAnswer)  override;
	virtual bool insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer) override;
	virtual bool insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1, const std::string& wrong_answer2) override;
	virtual bool insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1, const std::string& wrong_answer2, const std::string& wrong_answer3) override;
	virtual void insertTenRandomQuestions()override;
	virtual struct Player getPlayerStats(const unsigned int playerOffset)override;
	virtual int getNumberOfUsers()override;
	virtual int getPlayerPoints(const std::string& username) override;
	virtual std::vector<Question> getQuestionsForGame(const unsigned int roomQuestions) override ;
	virtual int getNumberOfQuestions()override;
	virtual int getLastGamePlayed()override;
	virtual int updatePlayerStats(const std::string& username, const int gamdid, const int questionsAnswered, const int correctlyAnsweredQuestions, const unsigned int avgTimeToAnswer)override;
private:
	sqlite3* _db;
	
	std::string _databaseName;
	
	std::shared_mutex _databaseMtx;
	std::shared_mutex _questionsTableMtx;
	std::shared_mutex _statisticsTalbeMtx;
	std::mutex _gameTableMtx;
	static int _getIntFromQuery(void* data, int arc, char** argv, char** azColname);
	static int _getAveragePlayerTime(void* data, int argc, char** argv, char** azColname);

	static int _getUsername(void* data, int arc, char** argv, char** azColname);


	bool _insertQuestion(const std::string& question, const std::string& right_answer, const std::string& wrong_answer1, const std::string& wrong_answer2, const std::string& wrong_answer3);

	static int _doesUserExist(void* data, int argc, char** argv, char** azColname);
	static int _doesPasswordMatch(void* data, int argc, char** argv, char** azColname);
	static int _getQuestion(void* data, int argc, char** argv, char** azColname);

	int calculatePoints(const int questionsAnswered, const int correctlyAnsweredQuestions, const unsigned int avgTimeToAnswer);
};

