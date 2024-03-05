import { Controller, Get, Render, Res } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as ejs from 'ejs';

@Controller('/web-login')
export class AuthController {
  @Get('/')
  //   @Render('web-login')
  async webLogin(@Res() res) {
    try {
      //   const ejsFile = await fs.readFile('src/views/web-login.ejs', 'utf8');
      const html = await ejs.renderFile('src/views/web-login.ejs', {});
      res.send(html);
    } catch (error) {
      console.log('🚀 - AuthController - webLogin - error:', error);
    }
  }
}
