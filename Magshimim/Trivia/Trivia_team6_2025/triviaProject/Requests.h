#pragma once
#include <iostream>
#include <string>
#include <vector>
#include "IRequestHandler.h"
class IRequestHandler;
typedef struct SignupRequest
{
	std::string username;
	std::string password;
	std::string email;
}SignupRequest;

typedef struct LoginRequest
{
	std::string username;
	std::string password;
}LoginRequest;
typedef struct RequestInfo
{
	unsigned char id;
	time_t time;
	std::vector<unsigned char> buffer;
}RequestInfo;

typedef struct RequestResult 
{
	IRequestHandler* newHandler;
	std::vector <unsigned char> buffer;
}RequestResult;

typedef struct GetPlayersInRoomRequest
{
	unsigned int roomId;
};
typedef struct JoinRoomRequest
{
	unsigned int roomId;
};
typedef struct CreateRoomRequest
{

	std::string roomName;

	unsigned int maxUsers;

	unsigned int questionCount;

	unsigned int answerTimeout;
};
typedef struct  HighScoreRequest
{
	unsigned int status;
};
typedef struct LogoutRequest
{
	unsigned int status;
};
typedef struct  GetRoomRequest
{
	unsigned int status;
};
typedef struct SubmitAnswerRequest 
{
	unsigned int answerId;
}SubmitAnswerRequest; 
enum RequestTypes 
{
	error,
	login,
	signup,
};