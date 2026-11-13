/* eslint-disable prettier/prettier */
import { ApiProperty} from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { Role } from "@prisma/client";

export class updateUserDto {
    
      @ApiProperty()
      @Expose()
      name!: string;
    
      @ApiProperty({ enum: Role })
      @Expose()
      role!: Role;
}