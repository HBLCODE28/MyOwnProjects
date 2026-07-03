#pragma once
#include <iostream>
#include "Requests.h"
struct RequestInfo;
struct LoginRequest;
struct SignupRequest;
struct RequestResult;
enum RequestTypes;
class IRequestHandler
{
private:
public:
	IRequestHandler();
	virtual ~IRequestHandler();
	virtual RequestResult handleRequest(const struct RequestInfo& info)=0;
	virtual bool isRequestRelevant(const struct RequestInfo& info)const=0;
};

