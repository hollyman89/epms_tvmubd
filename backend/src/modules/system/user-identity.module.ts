import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity";
import { UserIdentityProjectorService } from "./user-identity-projector.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserIdentityProjectorService],
  exports: [UserIdentityProjectorService],
})
export class UserIdentityModule {}
