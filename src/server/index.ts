import cors from 'cors';
import polka from 'polka';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import fetch, { Headers } from 'node-fetch';
import { json } from 'body-parser';
import * as ec from './ec';
import WebSocket from 'ws';
import { createServer } from 'http';
import serveFiles from './serve';

type FSHeaders = Headers & {
  authorization?: string;
}

type StatusCode = number;

export type FSRequest = Request & {
  headers: FSHeaders;
}

export type FSResponse = Response & {
  statusCode: StatusCode;

  sendJson: (resp: any) => void;
  error: (error: any, status: StatusCode) => void;
}

export type FSOptions = {
  user: string;
  trust: string;
  identity: string;
  port: number;
  root: string;
}

// TODO: RegEx check and warn for user and identity

// if (!config.user) {
//   console.log('Please provide your user name using -u <username> option');
//   process.exit();
// }

const helpers = (_: FSRequest, res: FSResponse, next: NextFunction) => {
  res.sendJson = (resp: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(resp));
  }
  res.error = (error: any, status: StatusCode = 500) => {
    res.statusCode = status;
    res.sendJson({
      error
      // TODO: context
    });
  };
  next();
}

export default async (options: FSOptions) => {
  const server = createServer();

  const resp = await fetch(options.trust);
  const cert = await resp.text();

  console.log(`Successfully fetched ${options.trust}: ${cert}`);
  const publicKey = ec.keyFromPublic(cert);

  const auth = (handler: RequestHandler) => (req: FSRequest, res: FSResponse, next: NextFunction) => {
    if (!req.headers.authorization) {
      return res.error('No authorization header', 401);
    }

    const [ts, signature] = req.headers.authorization.split(',');
    const payload = [options.user || 'matyunya', options.identity, ts].join(',');

    if (!publicKey.verify(payload, signature)) {
      res.error('Forbidden', 403);
    }
    else return handler(req, res, next);
  }

  const app = polka({ server });

  // @ts-ignore
  app
    .use(json(), helpers, cors())
    // @ts-ignore
    .use('/resource', auth(serveFiles(options.root)))
    // @ts-ignore
    .get('/identity', (_: FSRequest, res: FSResponse) => res.end(options.identity))

  app.listen(options.port, (err: Error) => {
      if (err) throw err;
      console.log(`> Running on localhost:${options.port}`);
      console.log('Serving ' + options.root);
    });

  return new WebSocket.Server({ server, path: '/ws' });
}
