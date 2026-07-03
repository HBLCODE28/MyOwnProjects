#include "Question.h"
Question::Question(std::string question, std::vector<std::string> answers) {
	this->_question = question;
	this->_answers = answers;
}
Question::Question()
{
	this->_question = "";
	this->_answers;
}
Question::~Question()
{
}
std::string Question::getQuestion()const 
{
	return this->_question;
}
std::vector<std::string> Question::getPossibleAnswers()const
{
	return this->_answers;
}
std::string Question::getCorrectAnswer()const
{
	return this->_answers[0];
}
Question& Question::operator=(const Question& other) 
{
	this->_question = other._question;
	this->_answers = other._answers;
	return *this;
}
#define RIGHT_ANSWER_ID 1
unsigned int Question::getCorrectAnswerId()const
{
	return RIGHT_ANSWER_ID;
}