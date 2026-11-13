/* eslint-disable prettier/prettier */
import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";

export class updateUserDto extends PartialType(OmitType(CreateUserDto, ['email', 'password'] as const)){}