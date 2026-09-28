import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn({ length: 20 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ unique: true, length: 254 })
  email!: string;

  @Column({ type: 'integer' })
  age!: number;

  @Column({ length: 30 })
  phone!: string;

  @Column({ default: true })
  isActive!: boolean;

  // ===================================================================
  // RELACIONES — esta entidad es standalone en esta rama (intencional).
  // No tiene @OneToMany a Order para mantenerla desacoplada:
  // - Order ya tiene @ManyToOne(() => User) y FK userId, así puedes
  //   hacer GET /orders?userId=... o GET /orders/user/:userId sin
  //   necesidad de que User conozca sus órdenes.
  // - Si quisieras bidireccional, añadirías aquí:
  //   @OneToMany(() => Order, (order) => order.user)
  //   orders: Order[];
  //   Pero genera import circular y acopla módulos; para didáctica
  //   se deja unidireccional. El diagrama ER muestra 1—N igual.
  // ===================================================================
}
