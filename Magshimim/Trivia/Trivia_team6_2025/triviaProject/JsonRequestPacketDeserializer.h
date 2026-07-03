#pragma once
#include <iostream>
#include <vector>
#include "Requests.h"
#include "json.hpp"

//All structs relevant to client requests must be created in this version.
using json = nlohmann::json;
class JsonRequestPacketDeserializer
{
public:
	static struct LoginRequest deserializeLoginRequest(const std::vector<unsigned char>& buffer);
	static struct SignupRequest deserializeSignUpRequest(const std::vector<unsigned char>&buffer);

	static struct GetPlayersInRoomRequest deserializeGetPlayersRequest(const std::vector<unsigned char>& buffer);
	static struct JoinRoomRequest deserializeJoinRoomRequest(const std::vector<unsigned char>& buffer);
	static struct CreateRoomRequest deserializeCreateRoomRequest(const std::vector<unsigned char>& buffer);
	static struct SubmitAnswerRequest deserializeSubmitAnswerRequest(const std::vector<unsigned char>& buffer);
	static unsigned int getGenericStatusCode(const std::vector<unsigned char>& buffer);

	
private:
};

