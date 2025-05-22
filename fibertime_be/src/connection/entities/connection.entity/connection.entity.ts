import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Device } from '../../../device/entities/device.entity/device.entity';
import { User } from '../../../user/entities/user.entity/user.entity';
import { ConnectionStatusType } from '../../../util/app.const';

// Tracks device pairing events
@Entity()
export class Connection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10, nullable: true, default: 'inactive' })
  status: ConnectionStatusType;

  @ManyToOne(() => Device, device => device.id)
  device: Device;

  @CreateDateColumn()
  createdAt: Date;
}