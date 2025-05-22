import { User } from '../../../user/entities/user.entity/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne } from 'typeorm';

@Entity()
export class OTP {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    code: string;

    @Column()
    expiresAt: Date;

    @Column({ default: 0 })
    attempts: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User)
    user: User
}