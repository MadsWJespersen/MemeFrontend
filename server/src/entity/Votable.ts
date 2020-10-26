import { Entity, OneToMany, PrimaryGeneratedColumn, TableInheritance } from "typeorm";
import { Vote } from "./Vote";

@Entity()
@TableInheritance({column: {type: 'varchar', name: 'type'}})
export abstract class Votable {

    @OneToMany(() => Vote, vote => vote.element)
    votes: Vote[];

}