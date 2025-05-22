import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { ConnectionStatusType } from '../../../util/app.const';

@Entity('devices')
export class Device {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index('idx_code')
    @Column({ length: 4, unique: true })
    code: string;

    @Column({ type: 'timestamp' })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @Index('idx_phone_number_device')
    @Column({ length: 15 })
    phoneNumber: string;
}
