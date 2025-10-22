import { PrismaClient } from '@prisma/client';
import { CreateVehicleData } from '../types';

export class VehicleRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateVehicleData) {
    return this.prisma.vehicle.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        family: {
          connect: { id: data.familyId }
        }
      }
    });
  }

  async findById(id: string) {
    return this.prisma.vehicle.findUnique({
      where: { id }
    });
  }

  async findByFamilyId(familyId: string) {
    return this.prisma.vehicle.findMany({
      where: { familyId }
    });
  }

  async update(id: string, data: Partial<CreateVehicleData>) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.capacity) updateData.capacity = data.capacity;
    if (data.familyId) {
      updateData.family = { connect: { id: data.familyId } };
    }
    
    return this.prisma.vehicle.update({
      where: { id },
      data: updateData
    });
  }

  async delete(id: string) {
    return this.prisma.vehicle.delete({
      where: { id }
    });
  }
}