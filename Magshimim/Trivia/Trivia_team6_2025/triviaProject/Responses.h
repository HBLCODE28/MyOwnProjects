#ifndef Responses
#define Responses
#include <vector>  
#include <string>
#include <iostream>
#include <map>
#include "Room.h"

struct LoginResponse
{
	unsigned int status;
};
struct SignupResponse
{
	unsigned int status;
};
struct ErrorResponse
{
	unsigned int message;
};
struct LogoutResponse 
{
	unsigned int status;
};

struct GetRoomsResponse 
{
	unsigned int status;
	std::vector<RoomData> rooms;
};
struct GetPlayersInRoomResponse 
{
	std::vector<std::string> players;
};
struct GetHighScoreResponse 
{
	unsigned int status;
	std::vector<std::string> stats;
	/*
		0- username
		1- points
	*/
};
struct GetPersonalStatsResponse 
{
	unsigned int status;
	std::vector<std::string> stats;
	/*
	* 0) - total number of questions answered
	* 1) - number of correctly answered questions
	* 2) - average time to answer
	* 3)- number of games played
	*/
};
struct JoinRoomResponse
{
	unsigned int status;
};
struct CreateRoomResponse
{
	unsigned int status;
};
typedef struct CloseRoomResponse 
{
	unsigned int status;
}CloseRoomResponse;
typedef struct StartGameResponse
{
	unsigned int status;
}StartGameResponse;
typedef struct GetRoomStateResponse 
{
	unsigned int status;
	unsigned int questionCount;
	bool hasGameBegun;
	std::vector<std::string> players;
	float answerTimeOut;
};
typedef struct LeaveRoomResponse
{
	unsigned int status;
}LeaveRoomResponse;
typedef struct LeaveGameResponse 
{
	unsigned int status;
}LeaveGameResponse;

typedef struct GetQuestionResponse 
{
	unsigned int status;
	std::string question;
	std::map<unsigned int, std::string>answers;
}GetQuestionResponse;
typedef struct SubmitAnswerResponse 
{
	unsigned int status;
	unsigned int correctAnswerId;
}SumbitAnswerResponse;
typedef struct PlayerResults 
{
	std::string username;
	unsigned int correctAnswerCount;
	unsigned int wrongAnswerCount;
	unsigned int averageAnswerTime;
};
typedef struct GetGameResultsResponse 
{
	unsigned int status;
	std::vector<struct PlayerResults> results;
}GetGameResutlsReponse;
enum LoginResponses :unsigned char
{
	LoginError=0,
	loginCode=1,
	signupCode=2,
	logoutCode=3
};
enum RoomResponse : unsigned char
{
	closeRoomResponse = 104,
	startGameResponse = 105,
	getRoomStateResponse = 106,
	leaveRoomResponse = 107,
	joinRoom = 102,
	createRoom = 100,
	getRooms = 101,
	playersInRoom = 103
};
enum GameResponse :unsigned char
{
	leaveGameResponseCode = 150,
	getQuestionResponseCode = 151,
	submitAnswerResponseCode = 152,
	getGameResultsResponseCode = 153
};
enum StatisticsResponses :unsigned char
{
	highScore=200,
	personalStats=201,
};
enum GeneralCodes :unsigned char
{
	generalErrorResponse, // 0
	generalSuccessResponse //1 
};
#endif //JsonResponsePacketSerializer_H