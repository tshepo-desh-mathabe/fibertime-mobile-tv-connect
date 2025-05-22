import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Device } from '../../../device/entities/device.entity/device.entity';

// Tracks service subscriptions
@Entity()
export class Bundle {
    @PrimaryGeneratedColumn('uuid')
    id: number;
    
    @ManyToOne(() => Device)
    @JoinColumn()
    device: Device;

    @Column()
    expiresAt: Date;

    @Column()
    remainingDays: number;

    @CreateDateColumn()
    createdAt: Date;
}