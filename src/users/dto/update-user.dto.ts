/* eslint-disable prettier/prettier */
import { ApiProperty} from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class updateUserDto {
    
      @ApiProperty()
      @Expose()
      @IsString()
      @IsOptional()
      name!: string;
    
      @ApiProperty({ enum: Role })
      @Expose()
      @IsEnum(Role)
      @IsOptional()
      role!: Role;
}