#pragma once
#include <vector>
#include <string>
class Question
{
private:
	std::string _question;
	std::vector<std::string> _answers;

public:
	Question();
	Question(std::string question, std::vector<std::string> answers);
	~Question();
	Question& operator=(const Question& other);
	std::string getQuestion()const;
	std::string getCorrectAnswer()const;
	unsigned int getCorrectAnswerId()const;
	std::vector<std::string> getPossibleAnswers()const;
};

