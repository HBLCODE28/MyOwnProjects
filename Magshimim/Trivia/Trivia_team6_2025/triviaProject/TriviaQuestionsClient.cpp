#include "TriviaQuestionsClient.h"
#pragma warning(suppress : 4996)
TriviaQuestionsClient::TriviaQuestionsClient(IDatabase* db,int questions )
{
	//this->_ssl;
	this->_db = db;
	this->_questions = questions;
	if (questions > MAX_QUESTIONS)
	{
		this->_questions = MAX_QUESTIONS;
	}
	else if (questions < MIN_QUESTIONS) 
	{
		this->_questions = MIN_QUESTIONS;
	}
	this->_apiRequest = OPEN_TDB_REQUEST_API_PART_1 + std::to_string(this->_questions) +OPEN_TDB_REQUEST_API_PART_2;
}
TriviaQuestionsClient::~TriviaQuestionsClient() 
{
}
std::vector<std::string> TriviaQuestionsClient::getQuestions()const
{
	return this->_questionsStr;
}