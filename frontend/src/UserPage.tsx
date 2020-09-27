import React from 'react';
import IState from './State';

function UserField(name:string,value:string){
  return(
    <li className="User-field">
      <text className="User-field-name">{name}</text>
      <br/>
      <text className="User-field-value">{value}</text>
    </li>
  );
}

function UserPicture(profilePicURL:string, classExtension :string) {
  let className = classExtension === "" ? "User-picture" : "User-picture-" + classExtension
  return (
    <img src={profilePicURL} className={className} alt="logo" />
  );
}

function UserPage (props:IState){
  return(
    <div className="User-page">
      <div className="User-box-container">
        <div className="User-box">  
            {UserPicture(props.profilePicURL,"")}
            <ul className="User-info">
              {UserField("USERNAME",props.username)}
              {UserField("E-MAIL",props.email)}                 
            </ul>
        </div>
      </div>
    </div>
  );
}


export {UserPage,UserPicture};
