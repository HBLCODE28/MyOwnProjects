#ifndef JsonResponsePacketSerializer_H
#define JsonResponsePacketSerializer_H

#include <vector>  
#include <iostream>


#include "Responses.h"
#include <string>
#include <ostream>




class JsonResponsePacketSerializer
{
public:
	//Class functions

	//The serializeLoginResponse function should be supported to receive a LoginResponse
	static std::vector<unsigned char> serializeLoginResponse(const LoginResponse& response);

	//The serializeSignUpResponse function should be supported to receive a SignupResponse
	static std::vector<unsigned char> serializeSignUpResponse(const SignupResponse& response);

	//The serializeErrorResponse function should be supported to receive an ErrorResponse
	static std::vector<unsigned char> serializeErrorResponse(const ErrorResponse& response);

	static std::vector<unsigned char> serializeLogoutResponse(const LogoutResponse& response);

	static std::vector<unsigned char>serializeGetRoomsResponse(const GetRoomsResponse& roomResponse);

	static std::vector<unsigned char> serializeGetPlayersInRoomResponse(const GetPlayersInRoomResponse& playersResponse);

	static std::vector<unsigned char> serializeJoinRoomResponse(const JoinRoomResponse& joinReponse); //

	static std::vector<unsigned char> serializeCreateRoomResponse(const CreateRoomResponse& createResponse);

	static std::vector<unsigned char> serializeHighScoreResponse(const GetHighScoreResponse& highScoreResponse);

	static std::vector<unsigned char> serializeCloseRoomResponse(const struct CloseRoomResponse& resp);

	static std::vector<unsigned char> serializeStartGameResponse(const struct StartGameResponse& resp);

	static std::vector<unsigned char> serializeGetRoomStateResponse(const struct GetRoomStateResponse& resp);
	static std::vector<unsigned char> serializeLeaveRoomResponse(const struct LeaveRoomResponse& resp);//

	static std::vector<unsigned char> serializeLeaveGameResponse(const struct LeaveGameResponse& resp);

	static std::vector<unsigned char> serializeGetQuestionResponse(const struct GetQuestionResponse& resp);
	static std::vector<unsigned char> serializeSubmitAnswerResponse(const struct SubmitAnswerResponse& resp);
	static std::vector<unsigned char> serializeGetGameResultsResponse(const struct GetGameResultsResponse& resp);
	static std::vector<unsigned char> serializeGetPersonalStatsResponse(const struct GetPersonalStatsResponse& resp);
};


#endif //JsonResponsePacketSerializer_H
