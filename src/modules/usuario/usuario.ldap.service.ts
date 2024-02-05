import * as ldap from 'ldapjs';
import { Injectable } from '@nestjs/common';
import { UserNotFoundError } from './errors/user-not-found.error';

@Injectable()
export class UsuarioLdapService {
  private createClient() {
    const client = ldap.createClient({
      url: process.env.LDAP_SERVER,
    });
    client.on('error', (err) => console.error('LDAP client error:', err));
    return client;
  }

  async authenticate(username: string, password: string): Promise<boolean> {
    const client = this.createClient();
    return new Promise((resolve, reject) => {
      client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_PASSWORD, (err) => {
        if (err) {
          console.error('Bind error:', err);
          this.close(client).then(() => reject(false));
          return;
        }

        const scope: 'sub' | 'base' | 'one' = 'sub';
        const searchOptions = {
          scope,
          filter: `(cn=${username})`,
          attributes: ['dn', 'cn', 'mail'],
        };

        client.search(process.env.LDAP_BASE, searchOptions, (err, res) => {
          if (err) {
            console.error('Search error:', err);
            this.close(client).then(() => reject(false));
            return;
          }

          let userDn = '';
          res.on('searchEntry', (entry) => {
            userDn = entry.objectName.toString();
          });

          res.on('error', (err) => {
            console.error('Search error:', err);
            this.close(client).then(() => reject(false));
          });

          res.on('end', async (_result) => {
            if (userDn) {
              client.bind(userDn, password, async (err) => {
                if (err) {
                  await this.close(client);
                  reject(new UserNotFoundError('Usuário ou senha inválidos.'));
                } else {
                  await this.close(client);
                  resolve(true);
                }
              });
            } else {
              console.error('User not found.');
              await this.close(client);
              reject(new UserNotFoundError('Usuário não encontrado'));
            }
          });
        });
      });
    });
  }

  async close(client: ldap.Client) {
    return new Promise((resolve, reject) => {
      client.unbind((err) => {
        if (err) {
          console.log('🚀 - UsuarioLdapService - close - err:', err);
          reject(err);
        } else {
          resolve(true);
        }
      });
      // this.client.destroy();
    });
  }
}
