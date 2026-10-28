import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InboxModule } from '../inbox/inbox.module';
import { ExecutiveController } from './executive.controller';
import { EXECUTIVE_READER, ExecutiveReadService } from './executive-read.service';
import { ExecutiveMaterializer } from './executive-materializer.service';

@Module({
  controllers:[ExecutiveController],
  providers:[ExecutiveReadService,{
    provide:EXECUTIVE_READER,inject:[DataSource],
    useFactory:async(source:DataSource)=>{
      const username=process.env.EXECUTIVE_ANALYTICS_READ_USER;
      if(!username) {
        if(process.env.NODE_ENV==='production') throw new Error('EXECUTIVE_ANALYTICS_READ_USER is required in production; grant SELECT on executive analytics tables only.');
        return source; // Local development only; SQL read boundary is still enforced by this module.
      }
      return new DataSource({...source.options,username,password:process.env.EXECUTIVE_ANALYTICS_READ_PASSWORD,entities:[],migrations:[],synchronize:false,logging:false} as any).initialize();
    },
  }],
})
export class ExecutiveAnalyticsReadModule {}

// No request handler is allowed to invoke this ingestion module.
@Module({imports:[InboxModule],providers:[ExecutiveMaterializer]})
export class ExecutiveAnalyticsWorkerModule {}
