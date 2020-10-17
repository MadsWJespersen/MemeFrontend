import { Request, response, Response } from "express";
import { getRepository } from "typeorm";
import { validate } from "class-validator";
import * as bcrypt from 'bcryptjs';
import * as jwt from "jsonwebtoken";
import { User } from "../entity/User";
import { randomStringOfLength, saveVerifyCompress } from "./MemeControllerHelperMethods";
import * as nodemailer from 'nodemailer';
import {uploadfolder,visualsFolder,soundsFolder, fileSizeLimit, profilePicFolder} from '../index';

class UserController{

  static hashPassword(password:string,salt:string) {
    return bcrypt.hashSync(password + salt, 8);
  };
  
  static checkIfUnencryptedPasswordIsValid(unencryptedPassword: string,user:User) {
    return bcrypt.compareSync(unencryptedPassword + user.salt, user.password);
  };

  static signToken(user:User){
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWTSECRET,
      { expiresIn: "1h" }
      );
    return token;
  }
  
  static async verifyUser(res:Response){
    const id = res.locals.jwtPayload.userId;
    let user: User;
    let UserRepository = getRepository(User);
    try {
      user = await UserRepository.findOneOrFail(id);
    } catch (id) {
      res.status(401).send();
      return;
    }
    return user;
  }
  
  static all = async (req: Request, res: Response) => {
    let UserRepository = getRepository(User);
    const users = await UserRepository.find({
      select: ["id", "username", "role"] 
    });
    
    res.send(users);
  };
  
  static one = async (req: Request, res: Response) => {
    
    const id: number = parseInt(req.params.id);
    let UserRepository = getRepository(User);
    
    try {
      const user = await UserRepository.findOneOrFail(id, {
        select: ["id", "username", "role"]
      });
    } catch (error) {
      res.status(404).send("User not found");
    }
  };
  
  static save = async (req: Request, res: Response) => {
    
    let { username, password, email} = req.body;
    let user = new User();
    user.username = username;
    user.email = email;
    user.profilePicFileName = "default.png";
    user.salt = randomStringOfLength(25);
    user.password = UserController.hashPassword(password,user.salt);
    user.role = "USER";
    
    const errors = await validate(user);
    if (errors.length > 0) {
      res.status(400).send();
      return;
    }
    let UserRepository = getRepository(User);
    
    try {
      await UserRepository.save(user);
    } catch (e) {
      res.setHeader("error","username or email already in use");
      res.status(409).send();
      return;
    }

    const token = UserController.signToken(user);
    
    res.status(201).send({token:token,username:user.username,profilePic:user.profilePicFileName,email:user.email});
  };
  
  static updateRole = async (req: Request, res: Response) => {
    
    const id = req.params.id;
    
    const { username, role } = req.body;
    let UserRepository = getRepository(User);
    
    let user;
    try {
      user = await UserRepository.findOneOrFail(id);
    } catch (error) {
      res.setHeader("error","User not found");
      res.status(404).send();
      return;
    }
    
    user.username = username;
    user.role = role;
    const errors = await validate(user);
    if (errors.length > 0) {
      res.status(400).send();
      return;
    }
    
    try {
      await UserRepository.save(user);
    } catch (e) {
      res.setHeader("error","username already in use");
      res.status(409).send();
      return;
    }

    res.status(204).send();
  };
  
  static remove = async (req: Request, res: Response) => {
    
    const {password} = req.body;
    if (!(password)) {
      res.status(400).send();
    }
    
    let user = await UserController.verifyUser(res);

    if(!user){
      return;
    }

    if (!UserController.checkIfUnencryptedPasswordIsValid(password,user)) {
      res.setHeader("error","Wrong password");
      res.status(401).send();
      return;
    }

    let UserRepository = getRepository(User);
    UserRepository.delete(user.id);
    res.status(204).send();
  };

  static update = async (req:Request, res:Response) => {

    let user = await UserController.verifyUser(res);

    if(!user){
      return;
    }

    if (!UserController.checkIfUnencryptedPasswordIsValid(req.body.password,user)) {
      res.setHeader("error","Wrong password");
      res.status(401).send();
      return;
    }

    if(req.body.profilePic){
      res = await UserController.changeProfilePic(req,res,user);
      if(res.statusCode !== 204){
        res.send();
        return;
      }
    }

    if(req.body.username){
      res = await UserController.changeUsername(req,res,user);
      if(res.statusCode !== 204){
        res.send();
        return;
      }
    }

    if(req.body.email){
      res = await UserController.changeEmail(req,res,user);
      if(res.statusCode !== 204){
        res.send();
        return;
      }
    }

    if(req.body.newPassword){
      res = await UserController.changePassword(req,res,user);
      if(res.statusCode !== 204){
        res.send();
        return;
      }
    }

    res.status(204).send(user)
    return;
  }

  static updateUsername = async (req:Request, res: Response) => {
    
    let user = await UserController.verifyUser(res);

    if(!user){
      return;
    }

    (await UserController.changeUsername(req,res,user)).send();
  }

  static changeUsername = async (req: Request, res: Response, user: User) => {
    const {newUsername, password} = req.body;
    if (!(newUsername && password)) {
      return res.status(400);
    }

    if (!UserController.checkIfUnencryptedPasswordIsValid(password,user)) {
      res.setHeader("error","Wrong password");
      return res.status(401);
    }
    
    user.username = newUsername;
    let UserRepository = getRepository(User);

    try {
      await UserRepository.save(user);
    } catch (e) {
      res.setHeader("error","Username already in use");
      return res.status(409);
    }

    const newToken = UserController.signToken(user);
    
    res.setHeader("token", newToken);   
    return res.status(204);
  }
    
  static updatePassword = async (req: Request, res: Response) => {
  
    let user = await UserController.verifyUser(res);
    
    if(!user){
      return;
    }
    
    (await UserController.changePassword(req,res,user)).send(user);
  };

  static changePassword = async(req: Request, res: Response, user: User) => {
    const { oldPassword, newPassword } = req.body;
    if (!(oldPassword && newPassword)) {
      res.status(400).send();
    }
    
    if (!UserController.checkIfUnencryptedPasswordIsValid(oldPassword,user)) {
      res.setHeader("error","Wrong password");
      return res.status(401);
    }
    
    //validate password length
    user.password = UserController.hashPassword(newPassword,user.salt);
    const errors = await validate(user);
    if (errors.length > 0) {
      res.setHeader("error","Password must be at least 7 characters long");
      return res.status(400);
      
    }
    let UserRepository = getRepository(User);
    
    UserRepository.save(user);
    
    const newToken = UserController.signToken(user);
    
    res.setHeader("token", newToken);  

    return res.status(204);
  }

  static updateProfilePic = async (req: Request, res: Response) => {
    let user = await UserController.verifyUser(res);

    if(!user){
      return;
    }

    (await UserController.changeProfilePic(req,res,user)).send(user);
  }

  static changeProfilePic = async (req: Request, res: Response, user: User) => {
    const newProfilePic = req.files.newProfilePic;
    if(!newProfilePic){
      return res.status(400);

    }

    if (newProfilePic.data.length > fileSizeLimit ){     
      res.setHeader("error","Filesize too large");
      return res.status(413);
    }

    let result = await saveVerifyCompress(newProfilePic,profilePicFolder,res);

    if(result.error){
      res.send(result.error);
    }

    user.profilePicFileName = result.filename;
    let UserRepository = getRepository(User);
    
    UserRepository.save(user);
    return res.status(204);
  }

  static changeEmail = async (req: Request, res: Response, user: User) => {
    const newEmail = req.body.email;
    if(!newEmail){
      return res.status(400);
    }

    user.profilePicFileName = newEmail;
    let UserRepository = getRepository(User);
    
    try {
      await UserRepository.save(user);
    } catch (e) {
      res.setHeader("error","Email already in use");
      return res.status(409);
    }

    const newToken = UserController.signToken(user);
    
    res.setHeader("token", newToken);   
    return res.status(204);
  }

  static recoverPassword = async (req: Request, res: Response) => {
    const {email} = req.body;
    if(!email){
      res.status(400).send("Bad request");
    }
    
    let UserRepository = getRepository(User);
    let user: User;
    try {
      user = await UserRepository.findOneOrFail({ where: { email } });
    } catch (id) {
      res.setHeader("error","No account with that email exists");
      res.status(401).send();
    }
    
    user.password = randomStringOfLength(10);

    UserRepository.save(user);
    
    var transporter = nodemailer.createTransport({
      service: `${process.env.BOTMAIL_SERVICE}`,
      auth: {
        user: `${process.env.BOTMAIL_EMAIL}`,
        pass: `${process.env.BOTMAIL_PASSWORD}`
      }
    });
    
    var mailOptions = {
      from: process.env.BOTMAIL_EMAIL,
      to: user.email,
      subject: 'Password reset',
      text: 'Your temporary password is ' + user.password
    };
    
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        res.status(400).send();
      } else {
        res.status(200).send();
      }
    });
  
  };
 
  static login = async (req: Request, res: Response) => {

    let { username, password } = req.body;
    if (!(username && password)) {
      res.status(400).send();
    }
    let UserRepository = getRepository(User);

    let user: User;
    try {
      user = await UserRepository.findOneOrFail({ 
        where: [
          { username: username },
          { email: username }
        ]
       });
    } catch (error) {
      console.log(error)
      res.status(401).send();
      return;
    }
    console.log(user.password)
    
    if (!UserController.checkIfUnencryptedPasswordIsValid(password,user)) {
      res.setHeader("error","Wrong password");
      res.status(401).send();
      return;
    }
    
    const token = UserController.signToken(user);
    
    res.setHeader("token", token);   
    res.send(user);
    return;
  };
  
}
  export default UserController;